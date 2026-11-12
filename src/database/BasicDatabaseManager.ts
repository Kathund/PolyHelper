import Database from 'better-sqlite3';
import { readFile, readdir } from 'node:fs/promises';
import type { DatabaseMigrationFile, DatabaseSearchFilters, MetadataEntry } from '../types/database.ts';

abstract class BasicDatabaseManager {
  protected abstract readonly databaseMigrationsPath: string;
  protected readonly db: Database.Database;
  constructor(private readonly databasePath: string) {
    this.db = new Database(this.databasePath);
  }

  checkForDatabase() {
    const metadataTable = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'metadata'")
      .get();
    if (!metadataTable) {
      console.other('I have no database! I am probably new.');
      console.other(`Will set up ${this.databasePath}`);
      this.initNewDB();
    }
  }

  private initNewDB() {
    this.db.exec(`CREATE TABLE metadata(
        key TEXT PRIMARY KEY,
        value TEXT
    ) STRICT`);

    this.insertMetadataEntry<'SchemaVersion'>({ key: 'SchemaVersion', value: '0' });
  }

  private async getMigrationFiles(): Promise<Map<number, DatabaseMigrationFile>> {
    const regex = /^(?<start>[0-9]+)-(?<end>[0-9]+)\.sql$/;
    const rawMigrationFiles = await readdir(this.databaseMigrationsPath, { encoding: 'utf-8' });
    const migrations = new Map<number, DatabaseMigrationFile>();
    for (const file of rawMigrationFiles) {
      const match = file.match(regex);
      if (!match?.groups) continue;
      const migration = { start: Number(match.groups.start), end: Number(match.groups.end), path: file };
      if (
        !Number.isSafeInteger(migration.start) ||
        !Number.isSafeInteger(migration.end) ||
        migration.end <= migration.start ||
        migrations.has(migration.start)
      ) {
        throw new Error(`Invalid or duplicate database migration at ${migration.path}`);
      }
      migrations.set(migration.start, migration);
    }
    return migrations;
  }

  getMetadataVersion(): number {
    let version: MetadataEntry<'SchemaVersion'> | undefined;
    try {
      version = this.getMetadataEntry('SchemaVersion');
    } catch {
      return 0;
    }
    if (!version) return 0;
    if (!/^\d+$/.test(version.value)) throw new Error(`Invalid database schema version - ${version.value}`);
    const dbversion = Number(version.value);
    if (!Number.isSafeInteger(dbversion)) throw new Error(`Invalid database schema version - ${version.value}`);
    return dbversion;
  }

  async checkForMigrations() {
    console.other('Checking whether DB needs migrations...');

    const migrationFiles = await this.getMigrationFiles();
    const dbversion = this.getMetadataVersion();
    const latestVersion = Math.max(0, ...[...migrationFiles.values()].map((migration) => migration.end));
    if (dbversion > latestVersion) {
      throw new Error(
        `Database schema version ${dbversion} is newer than this application's version ${latestVersion}.`
      );
    }

    const pendingMigrations: DatabaseMigrationFile[] = [];
    let expectedVersion = dbversion;
    while (expectedVersion < latestVersion) {
      const migration = migrationFiles.get(expectedVersion);
      if (!migration) throw new Error(`Missing database migration starting at schema version ${expectedVersion}.`);
      pendingMigrations.push(migration);
      expectedVersion = migration.end;
    }

    if (pendingMigrations.length === 0) return console.other('Database is already up to date.');
    for (const migration of pendingMigrations) await this.doDatabaseMigration(migration);

    console.other('Done with migrations.');
  }

  private async doDatabaseMigration(migration: DatabaseMigrationFile) {
    console.other(`Applying database migration ${migration.path}...`);
    const data = await readFile(`${this.databaseMigrationsPath}/${migration.path}`);
    if (!data) throw new Error(`The ${migration.path} file does not exist.`);
    this.db.exec(data.toString('utf-8'));
    this.updateMetadataEntry<'SchemaVersion'>({ key: 'SchemaVersion', value: migration.end.toString() });
  }

  getMetadataEntry<K extends string>(key: K): MetadataEntry<K> | undefined {
    return this.db.prepare<string, MetadataEntry<K>>('SELECT * FROM metadata WHERE key = ?').get(key);
  }

  setMetadataEntry<K extends string>(entry: MetadataEntry<K>) {
    const currentValue = this.getMetadataEntry<K>(entry.key);
    if (currentValue) this.updateMetadataEntry<K>(entry);
    else this.insertMetadataEntry<K>(entry);
  }

  private updateMetadataEntry<K extends string>(entry: MetadataEntry<K>) {
    this.db
      .prepare<MetadataEntry<K>>(
        'INSERT INTO metadata(key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(entry);
  }

  private insertMetadataEntry<K extends string>(entry: MetadataEntry<K>) {
    this.db.prepare<MetadataEntry<K>>('INSERT INTO metadata(key, value) VALUES (@key, @value)').run(entry);
  }

  deleteMetadataEntry<K extends string>(key: K) {
    this.db.prepare<string>('DELETE FROM metadata WHERE key = ?').run(key);
  }

  protected getOrder<Sort extends string>(
    filters: DatabaseSearchFilters<Sort>,
    sortColumns: Partial<Record<Sort | 'LastUpdated', string>>
  ): string {
    const sort = filters.sort ?? 'LastUpdated';
    const sortColumn = sort === 'None' ? undefined : sortColumns[sort as Sort | 'LastUpdated'];
    return sortColumn ? ` ORDER BY ${sortColumn} ${filters.sortDirection === 'ASC' ? 'ASC' : 'DESC'}` : '';
  }
}

export default BasicDatabaseManager;

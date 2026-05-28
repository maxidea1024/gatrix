import { CocosStorageProvider } from '../src/cocos-storage-provider';
import { InMemoryStorageProvider } from '../src/in-memory-storage-provider';

describe('InMemoryStorageProvider', () => {
  let storage: InMemoryStorageProvider;

  beforeEach(() => {
    storage = new InMemoryStorageProvider();
  });

  it('should return undefined for non-existent keys', async () => {
    const value = await storage.get('missing');
    expect(value).toBeUndefined();
  });

  it('should save and get values', async () => {
    await storage.save('key', { data: 'test' });
    const value = await storage.get('key');
    expect(value).toEqual({ data: 'test' });
  });

  it('should overwrite existing values', async () => {
    await storage.save('key', 'old');
    await storage.save('key', 'new');
    const value = await storage.get('key');
    expect(value).toBe('new');
  });

  it('should delete values', async () => {
    await storage.save('key', 'value');
    await storage.delete('key');
    const value = await storage.get('key');
    expect(value).toBeUndefined();
  });
});

describe('CocosStorageProvider', () => {
  let storage: CocosStorageProvider;

  // CocosCreator is not available in test environment,
  // so it will fall back to in-memory Map storage
  beforeEach(() => {
    storage = new CocosStorageProvider('test:');
  });

  it('should return undefined for non-existent keys', async () => {
    const value = await storage.get('missing');
    expect(value).toBeUndefined();
  });

  it('should save and get values (in-memory fallback)', async () => {
    await storage.save('key', { data: 'test' });
    const value = await storage.get('key');
    expect(value).toEqual({ data: 'test' });
  });

  it('should overwrite existing values', async () => {
    await storage.save('key', 'old');
    await storage.save('key', 'new');
    const value = await storage.get('key');
    expect(value).toBe('new');
  });

  it('should delete values', async () => {
    await storage.save('key', 'value');
    await storage.delete('key');
    const value = await storage.get('key');
    expect(value).toBeUndefined();
  });

  it('should use prefix for keys', async () => {
    const storage1 = new CocosStorageProvider('prefix1:');
    const storage2 = new CocosStorageProvider('prefix2:');
    await storage1.save('key', 'value1');
    await storage2.save('key', 'value2');
    expect(await storage1.get('key')).toBe('value1');
    expect(await storage2.get('key')).toBe('value2');
  });
});

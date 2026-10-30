export function listOptions(query = {}) {
  const integer = (value, fallback) => value === undefined ? fallback : (/^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN);
  const page = integer(query.page, 1);
  const limit = Math.min(integer(query.limit, 10), 10);
  if (!Number.isFinite(page) || !Number.isFinite(limit) || !Number.isSafeInteger(page * limit)) throw new Error('page dan limit harus bilangan bulat positif.');
  if (query.search !== undefined && typeof query.search !== 'string') throw new Error('search harus berupa teks.');
  const search = (query.search || '').trim();
  if (search.length > 100) throw new Error('search maksimal 100 karakter.');
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1, search };
}
export const pagination = (options, total) => ({ page: options.page, limit: options.limit, total, totalPages: Math.ceil(total / options.limit) });
export const searchPattern = (search) => `%${search.replace(/[\\%_]/g, '\\$&')}%`;

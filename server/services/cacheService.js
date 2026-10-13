/**
 * In-memory TTL Cache Service (Hỗ trợ cấu hình chuyển sang Redis khi cần scale cluster)
 * Cung cấp cache danh sách việc làm, external jobs, và thống kê để giảm tải DB.
 */
class CacheService {
  constructor() {
    this.store = new Map();
  }

  /**
   * Lưu giá trị vào cache với TTL (giây)
   */
  set(key, value, ttlSeconds = 60) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Lấy giá trị từ cache (null nếu hết hạn hoặc không có)
   */
  get(key) {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return record.value;
  }

  /**
   * Xóa một key cụ thể
   */
  del(key) {
    this.store.delete(key);
  }

  /**
   * Xóa tất cả các key bắt đầu bằng prefix
   */
  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Xóa toàn bộ cache
   */
  clear() {
    this.store.clear();
  }
}

export const cacheService = new CacheService();

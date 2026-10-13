import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const REDIS_URL = process.env.REDIS_URL || null;

// Fallback in-memory storage khi Redis server chưa sẵn sàng (Local dev / CI / Test)
const inMemoryStore = new Map();

export const isRedisConfigured = Boolean(process.env.REDIS_URL);
export let isRedisReady = false;
export let redisClient = null;

if (isRedisConfigured) {
  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            return false;
          }
          return Math.min(retries * 200, 1000);
        }
      }
    });

    redisClient.on('error', (err) => {
      isRedisReady = false;
      if (process.env.DEBUG === 'true') {
        console.warn('[Redis] Connection warning:', err.message);
      }
    });

    redisClient.on('connect', () => {
      isRedisReady = true;
      console.log(`[Redis] 🚀 Kết nối Redis thành công tại: ${REDIS_URL}`);
    });

    redisClient.on('ready', () => {
      isRedisReady = true;
    });

    redisClient.on('end', () => {
      isRedisReady = false;
    });

    // Kết nối non-blocking
    redisClient.connect().catch(() => {
      isRedisReady = false;
      console.log('[Redis] ℹ️ Không thể kết nối tới Redis server. Hệ thống sử dụng bộ nhớ đệm In-Memory Fallback.');
    });
  } catch (err) {
    isRedisReady = false;
    console.warn('[Redis] Khởi tạo Redis client thất bại:', err.message);
  }
} else {
  console.log('[Redis] ℹ️ Biến REDIS_URL chưa được cấu hình. Hệ thống tự động kích hoạt bộ nhớ đệm In-Memory Fallback.');
}

/**
 * Lấy dữ liệu từ Cache (Redis hoặc In-Memory Fallback)
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function getCache(key) {
  if (!key) return null;

  if (isRedisReady && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    } catch (err) {
      console.warn(`[Redis Get Error] Key "${key}":`, err.message);
    }
  }

  // In-Memory Fallback
  const record = inMemoryStore.get(key);
  if (!record) return null;
  if (record.expiresAt && Date.now() > record.expiresAt) {
    inMemoryStore.delete(key);
    return null;
  }
  return record.value;
}

/**
 * Lưu dữ liệu vào Cache với thời hạn (TTL tính bằng giây)
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSeconds=60]
 * @returns {Promise<boolean>}
 */
export async function setCache(key, value, ttlSeconds = 60) {
  if (!key) return false;

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  if (isRedisReady && redisClient) {
    try {
      if (ttlSeconds > 0) {
        await redisClient.setEx(key, ttlSeconds, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch (err) {
      console.warn(`[Redis Set Error] Key "${key}":`, err.message);
    }
  }

  // In-Memory Fallback
  const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  inMemoryStore.set(key, {
    value,
    expiresAt
  });
  return true;
}

/**
 * Xóa một key khỏi Cache
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function delCache(key) {
  if (!key) return false;

  if (isRedisReady && redisClient) {
    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      console.warn(`[Redis Del Error] Key "${key}":`, err.message);
    }
  }

  inMemoryStore.delete(key);
  return true;
}

/**
 * Xóa các key khớp với pattern (ví dụ: 'jobs:*')
 * @param {string} pattern - Pattern tìm kiếm key (vd: 'jobs:*')
 * @returns {Promise<number>} Số lượng key đã xóa
 */
export async function invalidateCachePattern(pattern) {
  let count = 0;

  if (isRedisReady && redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        count = await redisClient.del(keys);
      }
      return count;
    } catch (err) {
      console.warn(`[Redis Invalidate Error] Pattern "${pattern}":`, err.message);
    }
  }

  // In-Memory Fallback
  const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
  for (const key of inMemoryStore.keys()) {
    if (regex.test(key)) {
      inMemoryStore.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Helper chuyên biệt: Xóa cache danh sách việc làm khi có thêm/sửa/xóa/boost job
 */
export async function invalidateJobsCache() {
  const deletedCount = await invalidateCachePattern('jobs:*');
  if (process.env.DEBUG === 'true') {
    console.log(`[Cache] 🔄 Đã làm mới cache danh sách việc làm (${deletedCount} keys invalidated)`);
  }
  return deletedCount;
}

/**
 * Middleware Cache danh sách việc làm (Get List Jobs)
 * @param {number} [ttlSeconds=60] - Thời gian sống của cache (mặc định 60 giây)
 */
export function cacheJobsMiddleware(ttlSeconds = 60) {
  return async (req, res, next) => {
    // Chỉ cache các request HTTP GET
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `jobs:${req.originalUrl || req.url}`;

    try {
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Provider', isRedisReady ? 'redis' : 'in-memory');
        return res.json(cachedData);
      }

      // Giữ bản sao của res.json để đánh chặn dữ liệu trả về và lưu vào cache
      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Chỉ cache phản hồi thành công (HTTP 200)
        if (res.statusCode === 200 && body && body.success !== false) {
          setCache(cacheKey, body, ttlSeconds).catch((err) => {
            console.warn('[Cache Middleware Save Error]:', err.message);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.warn('[Cache Middleware Error]:', err.message);
      next();
    }
  };
}

/**
 * Thiết lập Socket.io Redis Adapter cho môi trường Scale Đa Instance
 * @param {import('socket.io').Server} io - Instance Socket.io
 * @returns {Promise<boolean>}
 */
export async function setupSocketIORedisAdapter(io) {
  if (!io) return false;

  // Nếu không có REDIS_URL hoặc Redis client chưa ready, sử dụng Default Memory Adapter
  if (!isRedisConfigured || !isRedisReady) {
    console.log('[Realtime] ℹ️ Redis Adapter chưa sẵn sàng. Socket.io sử dụng Default Memory Adapter.');
    return false;
  }

  try {
    const pubClient = createClient({
      url: REDIS_URL,
      socket: { connectTimeout: 2000 }
    });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      if (process.env.DEBUG === 'true') {
        console.warn('[Redis Adapter Pub Error]:', err.message);
      }
    });

    subClient.on('error', (err) => {
      if (process.env.DEBUG === 'true') {
        console.warn('[Redis Adapter Sub Error]:', err.message);
      }
    });

    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Realtime] 🚀 Socket.io Redis Adapter đã kích hoạt thành công (Đồng bộ Event Đa Instance)!');
    return true;
  } catch (err) {
    console.log('[Realtime] ℹ️ Kết nối Redis Adapter thất bại. Socket.io duy trì Memory Adapter mặc định.');
    return false;
  }
}

/**
 * Thử lấy Distributed Lock (Khóa phân tán đa Server) dùng Redis (hoặc Fallback bộ nhớ)
 * Ngăn chặn xung đột và chạy trùng lặp tác vụ cron / xử lý tác vụ nặng khi deploy nhiều replica.
 *
 * @param {string} lockKey - Tên khóa định danh
 * @param {number} [ttlSeconds=3600] - Thời gian tự động giải phóng lock (mặc định 1 giờ)
 * @returns {Promise<boolean>} true nếu giành được lock, false nếu đã bị instance khác chiếm giữ
 */
export async function acquireDistributedLock(lockKey, ttlSeconds = 3600) {
  if (!lockKey) return false;

  if (isRedisReady && redisClient) {
    try {
      // SET key value NX EX ttl
      const res = await redisClient.set(lockKey, 'locked', {
        NX: true,
        EX: ttlSeconds
      });
      return res === 'OK';
    } catch (err) {
      console.warn(`[Redis Distributed Lock Error] ${lockKey}:`, err.message);
    }
  }

  // Fallback in-memory cho môi trường Local / Single node / Test
  const record = inMemoryStore.get(lockKey);
  const now = Date.now();
  if (record && record.expiresAt && now < record.expiresAt) {
    return false; // Đã có instance khác giữ lock
  }

  inMemoryStore.set(lockKey, {
    value: 'locked',
    expiresAt: now + ttlSeconds * 1000
  });
  return true;
}

/**
 * Giải phóng Distributed Lock
 * @param {string} lockKey
 * @returns {Promise<boolean>}
 */
export async function releaseDistributedLock(lockKey) {
  return await delCache(lockKey);
}

export default {
  redisClient,
  isRedisReady,
  isRedisConfigured,
  getCache,
  setCache,
  delCache,
  invalidateCachePattern,
  invalidateJobsCache,
  cacheJobsMiddleware,
  setupSocketIORedisAdapter,
  acquireDistributedLock,
  releaseDistributedLock
};


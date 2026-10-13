import { redisClient, isRedisReady } from '../config/redis.js';

const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 phút = 900 giây
const MAX_FAILED_ATTEMPTS = 5;

// In-Memory Fallback khi Redis server chưa kết nối (Local dev / CI / Test)
const inMemoryFailedAttempts = new Map(); // userId -> { count: number, expiresAt: number }
const inMemoryLockouts = new Map();       // userId -> { expiresAt: number }

/**
 * Kiểm tra xem tài khoản có đang trong trạng thái bị khóa (Lockout) hay không
 * Sử dụng Redis key: lockout:userId
 * 
 * @param {string} userId - ID người dùng cần kiểm tra
 * @returns {Promise<{ isLocked: boolean, remainingSeconds: number, remainingMinutes: number }>}
 */
export async function isUserLockedOut(userId) {
  if (!userId) {
    return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0 };
  }

  const lockoutKey = `lockout:${userId}`;

  // 1. Kiểm tra qua Redis nếu sẵn sàng
  if (isRedisReady && redisClient) {
    try {
      const lockedVal = await redisClient.get(lockoutKey);
      if (lockedVal) {
        const ttl = await redisClient.ttl(lockoutKey);
        const remainingSeconds = ttl > 0 ? ttl : LOCKOUT_TTL_SECONDS;
        const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
        return { isLocked: true, remainingSeconds, remainingMinutes };
      }
      return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0 };
    } catch (err) {
      console.warn(`[Lockout Redis Get Error] ${lockoutKey}:`, err.message);
    }
  }

  // 2. In-Memory Fallback
  const memRecord = inMemoryLockouts.get(userId);
  if (memRecord) {
    const now = Date.now();
    if (now < memRecord.expiresAt) {
      const remainingSeconds = Math.max(1, Math.ceil((memRecord.expiresAt - now) / 1000));
      const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
      return { isLocked: true, remainingSeconds, remainingMinutes };
    }
    inMemoryLockouts.delete(userId);
  }

  return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0 };
}

/**
 * Ghi nhận một lần nhập sai mật khẩu cho tài khoản
 * Tăng bộ đếm failed_attempts:userId
 * Nếu đạt 5 lần liên tiếp -> Kích hoạt lockout:userId với TTL 15 phút (900s)
 * 
 * @param {string} userId - ID người dùng
 * @returns {Promise<{ isLocked: boolean, attempts: number, remainingAttempts: number, waitMinutes?: number }>}
 */
export async function recordFailedLogin(userId) {
  if (!userId) {
    return { isLocked: false, attempts: 0, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const attemptsKey = `failed_attempts:${userId}`;
  const lockoutKey = `lockout:${userId}`;

  // 1. Thao tác trên Redis khi kết nối sẵn sàng
  if (isRedisReady && redisClient) {
    try {
      const attempts = await redisClient.incr(attemptsKey);
      if (attempts === 1) {
        // Đặt TTL 15 phút cho bộ đếm lần thất bại đầu tiên
        await redisClient.expire(attemptsKey, LOCKOUT_TTL_SECONDS);
      }

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        // Khóa tài khoản trong 15 phút
        await redisClient.setEx(lockoutKey, LOCKOUT_TTL_SECONDS, 'locked');
        await redisClient.del(attemptsKey);
        return {
          isLocked: true,
          attempts: MAX_FAILED_ATTEMPTS,
          remainingAttempts: 0,
          waitMinutes: 15
        };
      }

      return {
        isLocked: false,
        attempts,
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - attempts)
      };
    } catch (err) {
      console.warn(`[Lockout Redis Incr Error] ${attemptsKey}:`, err.message);
    }
  }

  // 2. In-Memory Fallback
  const now = Date.now();
  let record = inMemoryFailedAttempts.get(userId);
  if (!record || now > record.expiresAt) {
    record = { count: 0, expiresAt: now + LOCKOUT_TTL_SECONDS * 1000 };
  }

  record.count += 1;
  inMemoryFailedAttempts.set(userId, record);

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    inMemoryLockouts.set(userId, { expiresAt: now + LOCKOUT_TTL_SECONDS * 1000 });
    inMemoryFailedAttempts.delete(userId);
    return {
      isLocked: true,
      attempts: MAX_FAILED_ATTEMPTS,
      remainingAttempts: 0,
      waitMinutes: 15
    };
  }

  return {
    isLocked: false,
    attempts: record.count,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.count)
  };
}

/**
 * Xóa bộ đếm số lần sai và gỡ bỏ khóa khi người dùng đăng nhập thành công
 * Xóa failed_attempts:userId và lockout:userId
 * 
 * @param {string} userId - ID người dùng
 * @returns {Promise<void>}
 */
export async function resetUserLockout(userId) {
  if (!userId) return;

  const attemptsKey = `failed_attempts:${userId}`;
  const lockoutKey = `lockout:${userId}`;

  if (isRedisReady && redisClient) {
    try {
      await redisClient.del(attemptsKey);
      await redisClient.del(lockoutKey);
    } catch (err) {
      console.warn(`[Lockout Redis Del Error]:`, err.message);
    }
  }

  inMemoryFailedAttempts.delete(userId);
  inMemoryLockouts.delete(userId);
}

export default {
  isUserLockedOut,
  recordFailedLogin,
  resetUserLockout
};

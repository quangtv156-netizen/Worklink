/**
 * Background Queue Service (Hàng đợi tác vụ bất đồng bộ)
 * Quản lý gửi mail, đồng bộ external jobs và tác vụ nặng nền (Sẵn sàng gắn BullMQ/Redis)
 */
class QueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.stats = { processed: 0, failed: 0 };
  }

  /**
   * Đẩy tác vụ vào hàng đợi
   * @param {string} taskName 
   * @param {Function} handler 
   * @param {object} payload 
   * @param {number} maxRetries 
   */
  enqueue(taskName, handler, payload = {}, maxRetries = 3) {
    this.queue.push({
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: taskName,
      handler,
      payload,
      maxRetries,
      attempts: 0,
      createdAt: new Date().toISOString()
    });

    // Kích hoạt xử lý ngầm không chặn luồng chính
    setImmediate(() => this.processNext());
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const task = this.queue.shift();
    try {
      task.attempts++;
      await task.handler(task.payload);
      this.stats.processed++;
    } catch (err) {
      console.error(`[Queue Error] Task [${task.name}] (attempt ${task.attempts}/${task.maxRetries}) thất bại:`, err.message);
      if (task.attempts < task.maxRetries) {
        // Đưa lại vào hàng đợi để thử lại sau
        setTimeout(() => {
          this.queue.push(task);
          this.processNext();
        }, 2000 * task.attempts);
      } else {
        this.stats.failed++;
        console.error(`[Queue Error] Task [${task.name}] đã hết số lần thử lại tối đa.`);
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  getStats() {
    return {
      pending: this.queue.length,
      processed: this.stats.processed,
      failed: this.stats.failed
    };
  }
}

export const queueService = new QueueService();

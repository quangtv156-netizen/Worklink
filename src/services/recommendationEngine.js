/**
 * Recommendation Engine cho WorkLink
 * Cá nhân hóa danh sách gợi ý việc làm dựa trên lịch sử xem, lưu, ứng tuyển và tìm kiếm
 */

export function getUserAffinities(userHistory = {}) {
  const {
    viewedJobIds = [],
    savedJobIds = [],
    appliedJobIds = [],
    searchKeywords = [],
    clickedHashtags = []
  } = userHistory;

  // Bản đồ tần suất quan tâm
  const categoryWeights = {};
  const districtWeights = {};
  const hashtagWeights = {};

  return {
    viewedJobIds,
    savedJobIds,
    appliedJobIds,
    searchKeywords,
    clickedHashtags,
    categoryWeights,
    districtWeights,
    hashtagWeights
  };
}

/**
 * Đề xuất danh sách công việc phù hợp nhất cho người dùng
 */
export function getRecommendedJobs(allJobs, userHistory = {}, currentJobId = null) {
  const {
    viewedJobIds = [],
    savedJobIds = [],
    appliedJobIds = [],
    clickedHashtags = []
  } = userHistory;

  // Lấy tập hợp công việc đã tương tác để phân tích sở thích
  const interactedJobs = allJobs.filter(job => 
    viewedJobIds.includes(job.id) || 
    savedJobIds.includes(job.id) || 
    appliedJobIds.includes(job.id)
  );

  // Nếu người dùng chưa có nhiều tương tác, đề xuất các công việc Hot và Pinned
  if (interactedJobs.length === 0 && clickedHashtags.length === 0) {
    return allJobs
      .filter(job => job.id !== currentJobId)
      .slice(0, 4)
      .map(j => ({ ...j, recReason: 'Việc làm thịnh hành được nhiều sinh viên quan tâm' }));
  }

  // Đếm tần suất ngành nghề và hashtag ưa thích
  const categoryFreq = {};
  const districtFreq = {};
  const hashtagFreq = {};

  interactedJobs.forEach(job => {
    // Ứng tuyển có trọng số cao nhất (x3), lưu (x2), xem (x1)
    const weight = appliedJobIds.includes(job.id) ? 3 : (savedJobIds.includes(job.id) ? 2 : 1);

    if (job.category) {
      categoryFreq[job.category] = (categoryFreq[job.category] || 0) + weight;
    }
    if (job.district) {
      districtFreq[job.district] = (districtFreq[job.district] || 0) + weight;
    }
    const tags = Array.isArray(job.hashtags) 
      ? job.hashtags 
      : (typeof job.hashtags === 'string' ? job.hashtags.split(' ').filter(Boolean) : []);
    tags.forEach(tag => {
      hashtagFreq[tag] = (hashtagFreq[tag] || 0) + weight;
    });
  });

  clickedHashtags.forEach(tag => {
    hashtagFreq[tag] = (hashtagFreq[tag] || 0) + 2;
  });

  // Chấm điểm các công việc chưa ứng tuyển
  const scored = allJobs
    .filter(job => job.id !== currentJobId)
    .map(job => {
      let score = 0;
      let reasons = [];

      if (categoryFreq[job.category]) {
        score += categoryFreq[job.category] * 10;
        reasons.push(`Cùng ngành ${job.category} bạn thường xem`);
      }

      if (districtFreq[job.district]) {
        score += districtFreq[job.district] * 8;
        reasons.push(`Gần khu vực ${job.district}`);
      }

      let commonTags = 0;
      const jTags = Array.isArray(job.hashtags) 
        ? job.hashtags 
        : (typeof job.hashtags === 'string' ? job.hashtags.split(' ').filter(Boolean) : []);
      jTags.forEach(tag => {
        if (hashtagFreq[tag]) {
          score += hashtagFreq[tag] * 5;
          commonTags++;
        }
      });

      if (commonTags > 0) {
        reasons.push(`Phù hợp với các thẻ bạn quan tâm`);
      }

      if (job.isHot) score += 5;
      if (job.isPinned) score += 4;

      return {
        ...job,
        recScore: score,
        recReason: reasons.length > 0 ? reasons.slice(0, 2).join(' • ') : 'Công việc nổi bật gợi ý cho bạn'
      };
    });

  scored.sort((a, b) => b.recScore - a.recScore);

  return scored.slice(0, 4);
}

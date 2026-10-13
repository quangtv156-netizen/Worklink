/**
 * WorkLink AI Natural Language Job Search Engine
 * Bóc tách ngôn ngữ tự nhiên tiếng Việt thành các tiêu chí lọc có cấu trúc
 */

// Danh sách từ khóa phân loại ngành nghề
const CATEGORY_MAP = [
  { key: 'IT', names: ['it', 'công nghệ', 'lập trình', 'developer', 'dev', 'react', 'node', 'frontend', 'backend', 'web', 'python', 'java', 'phần mềm', 'intern it'] },
  { key: 'F&B', names: ['phục vụ', 'f&b', 'bồi bàn', 'chạy bàn', 'pha chế', 'barista', 'quán cà phê', 'cafe', 'quán ăn', 'nhà hàng', 'trà sữa', 'thu ngân quán', 'bếp', 'phụ bếp'] },
  { key: 'Bán hàng', names: ['bán hàng', 'sales', 'tư vấn', 'shop', 'quần áo', 'thời trang', 'cửa hàng', 'thu ngân', 'siêu thị', 'tiện lợi'] },
  { key: 'Marketing', names: ['marketing', 'content', 'viết bài', 'fanpage', 'truyền thông', 'tiktok', 'seo', 'quảng cáo', 'copywriter'] },
  { key: 'Gia sư', names: ['gia sư', 'dạy kèm', 'tiếng anh', 'dạy học', 'ôn thi', 'ielts', 'toán', 'luyện thi'] },
  { key: 'Kho vận', names: ['kho', 'phụ kho', 'đóng gói', 'shopee', 'bốc xếp', 'giao nhận', 'vận chuyển'] },
  { key: 'Thiết kế', names: ['thiết kế', 'designer', 'đồ họa', 'photoshop', 'canva', 'figma', 'banner', 'logo'] },
  { key: 'Văn phòng', names: ['văn phòng', 'hành chính', 'nhập liệu', 'trực page', 'cskh', 'chăm sóc khách hàng'] }
];

// Danh sách quận/huyện phổ biến
const LOCATION_MAP = [
  { key: 'Cầu Giấy', names: ['cầu giấy', 'cau giay', 'dịch vọng', 'xuân thủy', 'trần thái tông', 'duy tân', 'trung hòa'] },
  { key: 'Đống Đa', names: ['đống đa', 'dong da', 'hoàng cầu', 'chùa bộc', 'tây sơn', 'đặng văn ngữ', 'thái hà', 'xã đàn'] },
  { key: 'Hai Bà Trưng', names: ['hai bà trưng', 'hai ba trung', 'bà triệu', 'phố huế', 'bạch mai', 'trần khát chân', 'minh khai'] },
  { key: 'Thanh Xuân', names: ['thanh xuân', 'thanh xuan', 'nguyễn trãi', 'khuất duy tiến', 'lê văn lương'] },
  { key: 'Ba Đình', names: ['ba đình', 'ba dinh', 'kim mã', 'đội cấn', 'liễu giai'] },
  { key: 'Hoàn Kiếm', names: ['hoàn kiếm', 'hoan kiem', 'phố cổ', 'tràng tiền', 'hồ gươm'] },
  { key: 'Nam Từ Liêm', names: ['nam từ liêm', 'nam tu liem', 'mỹ đình', 'keangnam', 'mễ trì'] },
  { key: 'Bắc Từ Liêm', names: ['bắc từ liêm', 'bac tu liem', 'nhổn', 'cổ nhuế'] },
  { key: 'Hoàng Mai', names: ['hoàng mai', 'hoang mai', 'định công', 'linh đàm', 'giáp bát'] },
  { key: 'Hà Đông', names: ['hà đông', 'ha dong', 'quang trung', 'văn quán'] },
  { key: 'Tây Hồ', names: ['tây hồ', 'tay ho', 'lạc long quân', 'âu cơ', 'xuân diệu'] },
  { key: 'TP.HCM', names: ['hồ chí minh', 'tphcm', 'sài gòn', 'quận 1', 'quận 3', 'quận 7', 'bình thạnh'] }
];

// Phân tích hình thức làm việc
const JOB_TYPE_MAP = [
  { key: 'PART_TIME', names: ['part-time', 'part time', 'bán thời gian', 'theo ca', 'ca linh hoạt', 'sinh viên', 'làm thêm', 'buổi'] },
  { key: 'FULL_TIME', names: ['full-time', 'full time', 'toàn thời gian', 'chính thức', 'hành chính'] },
  { key: 'INTERN', names: ['thực tập', 'intern', 'thực tập sinh', 'trainee', 'học việc'] },
  { key: 'FREELANCE', names: ['freelance', 'freelancer', 'tự do', 'dự án', 'remote', 'tại nhà'] }
];

// Phân tích ca làm việc
const TIME_SHIFT_MAP = [
  { key: 'BUỔI_TỐI', names: ['tối', 'buổi tối', 'ca tối', 'đêm', 'chiều tối', '17h', '18h', '19h'] },
  { key: 'BUỔI_SÁNG', names: ['sáng', 'buổi sáng', 'ca sáng', '7h', '8h'] },
  { key: 'BUỔI_CHIỀU', names: ['chiều', 'buổi chiều', 'ca chiều', '13h', '14h'] },
  { key: 'LINH_HOẠT', names: ['linh hoạt', 'linh động', 'tùy chọn', 'rảnh lúc nào làm lúc đó'] }
];

// Phân tích kinh nghiệm
const EXP_MAP = [
  { key: 'NO_EXPERIENCE', names: ['không yêu cầu kinh nghiệm', 'không cần kinh nghiệm', 'chưa có kinh nghiệm', 'không kinh nghiệm', 'mới bắt đầu', 'sinh viên', 'đào tạo từ đầu', 'tân binh'] },
  { key: 'LESS_THAN_1_YEAR', names: ['dưới 1 năm', 'kinh nghiệm cơ bản', 'ít kinh nghiệm', 'từng làm qua'] },
  { key: '1_TO_2_YEARS', names: ['1 năm', '2 năm', '1-2 năm', 'đã có kinh nghiệm'] }
];

/**
 * Chuẩn hóa chuỗi loại bỏ dấu tiếng Việt để tìm kiếm siêu nhạy
 */
export function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Phân tích câu truy vấn tự nhiên thành bộ lọc
 */
export function parseNaturalLanguageQuery(queryText) {
  if (!queryText || typeof queryText !== 'string') {
    return {
      category: null,
      job_type: null,
      location: null,
      time: null,
      experience: null,
      min_salary_hourly: null,
      min_salary_monthly: null,
      extracted_keywords: []
    };
  }

  const text = queryText.toLowerCase().trim();
  const textNoTone = removeVietnameseTones(queryText);

  const isMatch = (namesArray) => {
    return namesArray.some(n => {
      const nLower = n.toLowerCase();
      const nNoTone = removeVietnameseTones(n);
      if (nNoTone.length <= 4) {
        const regex = new RegExp(`(^|[^a-z0-9])${nNoTone}([^a-z0-9]|$)`, 'i');
        return regex.test(textNoTone);
      }
      return text.includes(nLower) || textNoTone.includes(nNoTone);
    });
  };

  // 1. Category
  let category = null;
  for (const item of CATEGORY_MAP) {
    if (isMatch(item.names)) {
      category = item.key;
      break;
    }
  }

  // 2. Job Type
  let job_type = null;
  for (const item of JOB_TYPE_MAP) {
    if (isMatch(item.names)) {
      job_type = item.key;
      break;
    }
  }

  // 3. Location
  let location = null;
  for (const item of LOCATION_MAP) {
    if (isMatch(item.names)) {
      location = item.key;
      break;
    }
  }

  // 4. Time Shift
  let time = null;
  if (/\b(tối|ca tối|buổi tối|chiều tối|đêm|ca đêm)\b/i.test(text) || /\b(ca toi|buoi toi|chieu toi|lam toi|ca dem|lam dem|sau 18h|sau 17h|18h|19h)\b/i.test(textNoTone)) {
    time = 'BUỔI_TỐI';
  } else if (/\b(sáng|ca sáng|buổi sáng)\b/i.test(text) || /\b(ca sang|buoi sang|lam sang|lam ca sang|7h|8h|9h)\b/i.test(textNoTone)) {
    time = 'BUỔI_SÁNG';
  } else if (/\b(chiều|ca chiều|buổi chiều)\b/i.test(text) || /\b(ca chieu|buoi chieu|lam chieu|13h|14h|15h)\b/i.test(textNoTone)) {
    time = 'BUỔI_CHIỀU';
  } else if (/\b(linh hoạt|linh động|tùy chọn|ca gãy)\b/i.test(text) || /\b(linh hoat|linh dong|tuy chon|ca gay)\b/i.test(textNoTone)) {
    time = 'LINH_HOẠT';
  }

  // 5. Experience
  let experience = null;
  for (const item of EXP_MAP) {
    if (isMatch(item.names)) {
      experience = item.key;
      break;
    }
  }


  // 6. Salary parser (30k/h, 30.000, 5 triệu...)
  let min_salary_hourly = null;
  let min_salary_monthly = null;

  // Lương giờ: 30k, 35k, 40.000đ/giờ
  const hourlyMatch = text.match(/(\d+)\s*(k|nghìn|ngàn|000)?\s*(\/|mỗi|theo)?\s*(giờ|h|tiếng)/i);
  if (hourlyMatch) {
    const num = parseInt(hourlyMatch[1], 10);
    min_salary_hourly = num < 100 ? num * 1000 : num;
  } else {
    // pattern: lương trên 30k
    const simpleK = text.match(/trên\s*(\d+)\s*k/i);
    if (simpleK) {
      min_salary_hourly = parseInt(simpleK[1], 10) * 1000;
    }
  }

  // Lương tháng: trên 10 triệu, 5-8 triệu
  const monthlyMatch = text.match(/(\d+)\s*(triệu|tr|m)/i);
  if (monthlyMatch && !hourlyMatch) {
    min_salary_monthly = parseInt(monthlyMatch[1], 10) * 1000000;
  }

  return {
    category,
    job_type,
    location,
    time,
    experience,
    min_salary_hourly,
    min_salary_monthly,
    raw_query: queryText
  };
}

/**
 * Lọc và chấm điểm mức độ phù hợp (% matching) giữa truy vấn AI và danh sách Job
 */
export function filterAndRankJobs(jobs, naturalQuery, filters = {}) {
  const extracted = parseNaturalLanguageQuery(naturalQuery);

  // Gộp tiêu chí từ câu hỏi AI và bộ lọc thủ công (nếu có)
  const criteria = {
    category: filters.category || extracted.category,
    job_type: filters.job_type || extracted.job_type,
    location: filters.location || extracted.location,
    time: filters.time || extracted.time,
    experience: filters.experience || extracted.experience,
    min_salary_hourly: filters.min_salary_hourly || extracted.min_salary_hourly,
    min_salary_monthly: filters.min_salary_monthly || extracted.min_salary_monthly,
    keyword: filters.keyword ? filters.keyword.toLowerCase().trim() : '',
    hashtag: filters.hashtag ? filters.hashtag.toLowerCase().trim() : ''
  };

  const results = jobs.map(job => {
    let score = 0;
    let maxPossibleScore = 0;
    const matchReasons = [];

    // 1. Category match (Trọng số cao: 30đ)
    if (criteria.category) {
      maxPossibleScore += 30;
      if (job.category === criteria.category) {
        score += 30;
        matchReasons.push(`Đúng ngành: ${job.category}`);
      }
    }

    // 2. Location / District match (Trọng số: 25đ)
    if (criteria.location) {
      maxPossibleScore += 25;
      if (job.district?.toLowerCase().includes(criteria.location.toLowerCase()) || 
          job.city?.toLowerCase().includes(criteria.location.toLowerCase()) ||
          job.address?.toLowerCase().includes(criteria.location.toLowerCase())) {
        score += 25;
        matchReasons.push(`Gần khu vực: ${job.district}`);
      }
    }

    // 3. Job Type match (Trọng số: 20đ)
    if (criteria.job_type) {
      maxPossibleScore += 20;
      if (job.jobType === criteria.job_type) {
        score += 20;
        matchReasons.push(`Đúng hình thức: ${job.jobType}`);
      }
    }

    // 4. Time Shift match (Trọng số: 15đ)
    if (criteria.time) {
      maxPossibleScore += 15;
      const shiftUpper = job.timeShift?.toUpperCase();
      if ((criteria.time === 'BUỔI_TỐI' && (shiftUpper === 'TỐI' || job.timeHours?.includes('18') || job.timeHours?.includes('17'))) ||
          (criteria.time === 'BUỔI_SÁNG' && (shiftUpper === 'SÁNG' || job.timeHours?.includes('07') || job.timeHours?.includes('8'))) ||
          (criteria.time === 'BUỔI_CHIỀU' && shiftUpper === 'CHIỀU') ||
          (criteria.time === 'LINH_HOẠT' && (shiftUpper === 'LINH HOẠT' || shiftUpper === 'LINH ĐỘNG'))) {
        score += 15;
        matchReasons.push(`Khớp ca làm việc (${job.timeShift})`);
      }
    }

    // 5. Experience match (Trọng số: 10đ)
    if (criteria.experience) {
      maxPossibleScore += 10;
      if (job.experience === criteria.experience || 
          (criteria.experience === 'NO_EXPERIENCE' && job.experience === 'NO_EXPERIENCE')) {
        score += 10;
        matchReasons.push('Phù hợp mức kinh nghiệm');
      }
    }

    // 6. Salary criteria
    if (criteria.min_salary_hourly && job.salaryType === 'hourly') {
      maxPossibleScore += 15;
      if (job.salaryMin >= criteria.min_salary_hourly || job.salaryMax >= criteria.min_salary_hourly) {
        score += 15;
        matchReasons.push(`Lương đạt yêu cầu (≥ ${criteria.min_salary_hourly.toLocaleString()}đ/h)`);
      }
    }

    // 7. Keyword & Hashtag direct search
    if (criteria.keyword) {
      maxPossibleScore += 20;
      const searchSpace = `${job.title} ${job.company} ${job.description} ${job.hashtags.join(' ')}`.toLowerCase();
      const searchSpaceNoTone = removeVietnameseTones(searchSpace);
      const kwLower = criteria.keyword.toLowerCase();
      const kwNoTone = removeVietnameseTones(criteria.keyword);
      if (searchSpace.includes(kwLower) || searchSpaceNoTone.includes(kwNoTone)) {
        score += 20;
        matchReasons.push(`Khớp từ khóa "${criteria.keyword}"`);
      }
    }


    if (criteria.hashtag) {
      maxPossibleScore += 20;
      const cleanTag = criteria.hashtag.startsWith('#') ? criteria.hashtag : `#${criteria.hashtag}`;
      if (job.hashtags?.some(tag => tag.toLowerCase() === cleanTag)) {
        score += 20;
        matchReasons.push(`Khớp hashtag ${cleanTag}`);
      }
    }

    // Default base matching if no criteria provided
    let matchPercentage = 0;
    if (maxPossibleScore > 0) {
      matchPercentage = Math.round((score / maxPossibleScore) * 100);
    } else if (!naturalQuery?.trim() && !criteria.keyword && !criteria.hashtag) {
      // Prioritize hot/pinned jobs when NO query/filter is entered (general browsing)
      matchPercentage = job.isHot ? 95 : 80;
    } else {
      // User entered a query but nothing matched
      matchPercentage = 0;
    }

    // Boost hot jobs slightly
    if (job.isHot && matchPercentage > 0) matchPercentage = Math.min(100, matchPercentage + 5);

    return {
      ...job,
      matchScore: matchPercentage,
      matchReasons: matchReasons.length > 0 ? matchReasons : ['Việc làm nổi bật trong khu vực']
    };
  });

  // Lọc chỉ giữ các job có độ tương thích tốt (hoặc tất cả nếu không có tiêu chí chặt)
  const isSearchActive = Boolean(naturalQuery?.trim() || criteria.keyword || criteria.hashtag || criteria.category || criteria.location);

  let filtered = isSearchActive 
    ? results.filter(j => j.matchScore >= 40)
    : results;

  // QUY TẮC RÀNG BUỘC NGÀNH NGHỀ: Nếu người dùng đã chỉ định ngành nghề cụ thể (VD: IT, F&B, Bán hàng),
  // TUYỆT ĐỐI chỉ giữ lại các công việc thuộc đúng ngành đó!
  if (criteria.category) {
    filtered = filtered.filter(j => j.category === criteria.category);
  }

  // LỌC THEO HẠN NỘP HỒ SƠ (Chỉ tin còn hạn tuyển)
  if (filters.active_only) {
    const today = new Date().toISOString().slice(0, 10);
    filtered = filtered.filter(j => !j.deadline || j.deadline >= today);
  }

  // Sắp xếp: Ưu tiên Pinned -> Hot -> Điểm match cao nhất
  filtered.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return b.views - a.views;
  });

  return {
    extractedCriteria: extracted,
    rankedJobs: filtered
  };
}

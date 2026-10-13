/**
 * WorkLink Job Aggregator Service — Dữ liệu Minh hoạ (Demo)
 *
 * ⚠️  LƯU Ý: Toàn bộ tin tuyển dụng trong file này là DỮ LIỆU MẪU (DEMO).
 *     Tên công ty, mức lương, link ứng tuyển đều là HƯ CẤU phục vụ mục đích
 *     minh hoạ giao diện. Không đại diện cho tin tuyển dụng thực tế nào.
 *
 * Hướng phát triển thực tế: Tích hợp API công khai của các sàn tuyển dụng
 * (ví dụ: ITviec, TopCV — nếu họ cung cấp API đối tác) hoặc RSS feed hợp lệ.
 */

// ============================================================
// CONFIG — Nguồn dữ liệu (Demo)
// ============================================================
const SOURCES = [
  {
    id: 'demo-board',
    name: 'Demo Board',
    logo: null,
    color: '#00b14f',
    baseUrl: '#',
    verified: false,
    tagline: 'Dữ liệu minh hoạ — Không phải tin tuyển dụng thực tế',
    enabled: true
  }
];

// Cache bộ nhớ tạm để tối ưu tốc độ phản hồi
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 phút

// ============================================================
// DỮ LIỆU MẪU — Tên công ty hoàn toàn hư cấu, chỉ để minh hoạ UI
// ============================================================
const DEMO_JOBS = [
  {
    id: 'demo-it-001',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Frontend Developer (ReactJS / TypeScript)',
    company: 'Alpha Tech Solutions (Demo)',
    category: 'IT',
    salary: '16 - 30 triệu',
    location: 'Hà Nội',
    district: 'Cầu Giấy',
    isVerified: false,
    badges: ['Demo', 'ReactJS', 'TypeScript'],
    description: '[DỮ LIỆU MẪU] Phát triển giao diện web ứng dụng sử dụng ReactJS 18+, TypeScript, Tailwind CSS, Redux Toolkit.',
    requirements: 'Tối thiểu 1 năm kinh nghiệm làm việc với ReactJS, thành thạo ES6+, Git, RESTful API.',
    publishedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-it-002',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Backend Engineer (Node.js / Express / PostgreSQL)',
    company: 'Beta Systems Corp (Demo)',
    category: 'IT',
    salary: '22 - 42 triệu',
    location: 'TP. HCM',
    district: 'Quận 7',
    isVerified: false,
    badges: ['Demo', 'Node.js', 'PostgreSQL'],
    description: '[DỮ LIỆU MẪU] Xây dựng và bảo trì các dịch vụ microservices với Node.js, Express, PostgreSQL, Redis và Kafka.',
    requirements: 'Thành thạo JavaScript/TypeScript, có kinh nghiệm thiết kế CSDL quan hệ PostgreSQL.',
    publishedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-it-003',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Thực tập sinh Lập trình Web Fullstack (React + Node.js)',
    company: 'Gamma Software House (Demo)',
    category: 'IT',
    salary: '4 - 7 triệu (Có phụ cấp)',
    location: 'Hà Nội',
    district: 'Nam Từ Liêm',
    isVerified: false,
    badges: ['Demo', 'Internship', 'Fullstack'],
    description: '[DỮ LIỆU MẪU] Chương trình đào tạo thực tập sinh có lương. Được Mentor hướng dẫn và tham gia dự án thực tế.',
    requirements: 'Sinh viên năm 3, 4 hoặc mới tốt nghiệp ngành CNTT. Biết React hoặc Node.js cơ bản.',
    publishedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-it-004',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Lập trình viên Mobile (Flutter / React Native)',
    company: 'Delta Fintech Lab (Demo)',
    category: 'IT',
    salary: '25 - 45 triệu',
    location: 'TP. HCM',
    district: 'Quận 3',
    isVerified: false,
    badges: ['Demo', 'Flutter', 'Mobile'],
    description: '[DỮ LIỆU MẪU] Phát triển ứng dụng mobile với Flutter hoặc React Native cho sản phẩm fintech.',
    requirements: 'Có từ 2 năm kinh nghiệm phát triển app Flutter hoặc React Native.',
    publishedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-it-005',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Data Analyst / Chuyên viên Phân tích Dữ liệu BI',
    company: 'Epsilon Analytics (Demo)',
    category: 'IT',
    salary: '18 - 35 triệu',
    location: 'Hà Nội',
    district: 'Hoàn Kiếm',
    isVerified: false,
    badges: ['Demo', 'Power BI', 'SQL'],
    description: '[DỮ LIỆU MẪU] Phân tích dữ liệu và xây dựng hệ thống báo cáo trên Power BI / Tableau.',
    requirements: 'Thành thạo SQL, Python/R phân tích dữ liệu, kỹ năng trực quan hóa dữ liệu.',
    publishedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-mkt-006',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Chuyên viên Digital Marketing (Performance & Ads)',
    company: 'Zeta Commerce Group (Demo)',
    category: 'Marketing',
    salary: '14 - 24 triệu',
    location: 'TP. HCM',
    district: 'Quận 1',
    isVerified: false,
    badges: ['Demo', 'Google Ads', 'Meta Ads'],
    description: '[DỮ LIỆU MẪU] Lập kế hoạch và tối ưu ngân sách quảng cáo đa kênh cho các chiến dịch e-commerce.',
    requirements: 'Có 1-2 năm kinh nghiệm chạy ads đa kênh, hiểu biết về Google Analytics 4.',
    publishedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-mkt-007',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Nhân viên Sáng tạo Nội dung (TikTok & Social Media)',
    company: 'Eta Creative Studio (Demo)',
    category: 'Marketing',
    salary: '11 - 18 triệu',
    location: 'Hà Nội',
    district: 'Bắc Từ Liêm',
    isVerified: false,
    badges: ['Demo', 'TikTok', 'Content'],
    description: '[DỮ LIỆU MẪU] Lên kịch bản, quay dựng video ngắn TikTok/Reels, theo dõi xu hướng trending.',
    requirements: 'Năng động, có khiếu kể chuyện. Biết sử dụng CapCut/Premiere cơ bản.',
    publishedAt: new Date(Date.now() - 7 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-fnb-008',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Nhân viên Barista / Pha chế (Full/Part-time)',
    company: 'Theta Coffee Chain (Demo)',
    category: 'F&B',
    salary: '25.000 - 35.000đ/giờ',
    location: 'Hà Nội',
    district: 'Đống Đa',
    isVerified: false,
    badges: ['Demo', 'Part-time OK', 'Đào tạo miễn phí'],
    description: '[DỮ LIỆU MẪU] Pha chế cà phê theo công thức tiêu chuẩn. Chưa có kinh nghiệm sẽ được đào tạo.',
    requirements: 'Chăm chỉ, nhanh nhẹn, trung thực. Chưa có kinh nghiệm vẫn apply được.',
    publishedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-fnb-009',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Giám sát Ca / Quản lý Sảnh Nhà hàng',
    company: 'Iota Restaurant Group (Demo)',
    category: 'F&B',
    salary: '10 - 15 triệu (+ Tip)',
    location: 'TP. HCM',
    district: 'Quận 1',
    isVerified: false,
    badges: ['Demo', 'Quản lý', 'F&B'],
    description: '[DỮ LIỆU MẪU] Điều phối hoạt động phục vụ trong ca, đảm bảo chất lượng dịch vụ và hướng dẫn nhân viên.',
    requirements: 'Giao tiếp tiếng Anh cơ bản, có ít nhất 1 năm kinh nghiệm F&B.',
    publishedAt: new Date(Date.now() - 9 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-sale-010',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Chuyên viên Tư vấn Giải pháp Công nghệ B2B',
    company: 'Kappa Tech Ventures (Demo)',
    category: 'Bán hàng',
    salary: '15 - 35 triệu (Lương cứng + Hoa hồng)',
    location: 'Hà Nội',
    district: 'Cầu Giấy',
    isVerified: false,
    badges: ['Demo', 'B2B Sales', 'Tech'],
    description: '[DỮ LIỆU MẪU] Tiếp cận và tư vấn các gói dịch vụ Cloud, hạ tầng cho doanh nghiệp vừa và lớn.',
    requirements: 'Kỹ năng thuyết trình, đàm phán tốt. Đam mê kinh doanh trong ngành công nghệ.',
    publishedAt: new Date(Date.now() - 10 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-des-011',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'UI/UX Product Designer (Mobile & Web App)',
    company: 'Lambda Design Studio (Demo)',
    category: 'Thiết kế',
    salary: '18 - 32 triệu',
    location: 'Hà Nội',
    district: 'Nam Từ Liêm',
    isVerified: false,
    badges: ['Demo', 'Figma', 'UX Research'],
    description: '[DỮ LIỆU MẪU] Nghiên cứu UX, thiết kế wireframe, prototype và Design System trên Figma.',
    requirements: 'Portfolio UI/UX xuất sắc, thành thạo Figma, Auto Layout, Component System.',
    publishedAt: new Date(Date.now() - 11 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-acc-012',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Nhân viên Kế toán Tổng hợp',
    company: 'Mu Hospitality Co (Demo)',
    category: 'Kế toán',
    salary: '11 - 17 triệu',
    location: 'Hà Nội',
    district: 'Thanh Xuân',
    isVerified: false,
    badges: ['Demo', 'MISA', 'Kế toán'],
    description: '[DỮ LIỆU MẪU] Kiểm tra số liệu chứng từ kế toán, lập báo cáo tài chính và kê khai thuế.',
    requirements: 'Tốt nghiệp chuyên ngành Kế toán/Kiểm toán, thành thạo MISA / SAP và Excel nâng cao.',
    publishedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-cst-013',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Chuyên viên Chăm sóc Khách hàng & Hỗ trợ Kỹ thuật',
    company: 'Nu Telecom (Demo)',
    category: 'Dịch vụ',
    salary: '9 - 16 triệu',
    location: 'Đà Nẵng',
    district: 'Hải Châu',
    isVerified: false,
    badges: ['Demo', 'CSKH', 'Call Center'],
    description: '[DỮ LIỆU MẪU] Tiếp nhận yêu cầu, tư vấn và xử lý sự cố dịch vụ cho khách hàng qua tổng đài.',
    requirements: 'Giọng nói chuẩn, dễ nghe; kiên nhẫn và có tinh thần trách nhiệm cao.',
    publishedAt: new Date(Date.now() - 13 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-it-014',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'DevOps / Cloud Platform Engineer (AWS / Kubernetes)',
    company: 'Xi Cloud Infrastructure (Demo)',
    category: 'IT',
    salary: '24 - 45 triệu',
    location: 'Hà Nội',
    district: 'Cầu Giấy',
    isVerified: false,
    badges: ['Demo', 'AWS', 'Kubernetes'],
    description: '[DỮ LIỆU MẪU] Quản trị hệ thống Cloud AWS, tự động hóa CI/CD, giám sát hệ thống với Prometheus & Grafana.',
    requirements: 'Có từ 2 năm kinh nghiệm DevOps, thành thạo Docker, K8s, Linux, Terraform.',
    publishedAt: new Date(Date.now() - 14 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-hr-015',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Chuyên viên Tuyển dụng & Thu hút Tài năng (Talent Acquisition)',
    company: 'Omicron HR Tech (Demo)',
    category: 'Nhân sự',
    salary: '12 - 20 triệu',
    location: 'Hà Nội',
    district: 'Cầu Giấy',
    isVerified: false,
    badges: ['Demo', 'Tuyển dụng', 'HR Tech'],
    description: '[DỮ LIỆU MẪU] Tìm kiếm và thu hút nhân tài, phỏng vấn, đánh giá ứng viên công nghệ và kinh doanh.',
    requirements: 'Có tối thiểu 1 năm kinh nghiệm làm tuyển dụng, giao tiếp khéo léo.',
    publishedAt: new Date(Date.now() - 15 * 3600000).toISOString(),
    isExternal: true
  },
  {
    id: 'demo-log-016',
    source: 'demo-board',
    sourceName: 'Demo Board',
    sourceColor: '#00b14f',
    sourceLogo: null,
    applyUrl: '#',
    title: 'Nhân viên Điều phối Kho bãi & Giao nhận Logistics',
    company: 'Pi Logistics Network (Demo)',
    category: 'Kho vận',
    salary: '8.5 - 14 triệu',
    location: 'Hà Nội',
    district: 'Hoàng Mai',
    isVerified: false,
    badges: ['Demo', 'Logistics', 'BHXH đầy đủ'],
    description: '[DỮ LIỆU MẪU] Điều phối dòng hàng nhập xuất tại trung tâm kho vận, theo dõi lịch trình và quản lý nhóm giao nhận.',
    requirements: 'Sức khỏe tốt, biết sử dụng smartphone và phần mềm quản trị kho.',
    publishedAt: new Date(Date.now() - 16 * 3600000).toISOString(),
    isExternal: true
  }
];

// ============================================================
// MAIN EXPORT: Lấy danh sách việc làm (Demo)
// ============================================================
export async function fetchExternalJobs({ keyword = '', location = '', category = '' } = {}) {
  const now = Date.now();

  // Trả về từ cache nếu còn hạn
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) {
    return filterJobs(_cache, { keyword, location, category });
  }

  console.log('[JobAggregator] Loading demo jobs catalog...');

  let allJobs = DEMO_JOBS.map(job => {
    const cleanTitle = (job.title || '').replace(/\(.*?\)/g, '').trim();
    const realUrl = `https://www.topcv.vn/tim-viec-lam?keyword=${encodeURIComponent(cleanTitle || 'developer')}`;
    return {
      ...job,
      applyUrl: (!job.applyUrl || job.applyUrl === '#') ? realUrl : job.applyUrl
    };
  });

  // Sắp xếp tin mới nhất lên đầu
  allJobs.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  _cache = allJobs;
  _cacheTime = now;

  console.log(`[JobAggregator] Ready: ${allJobs.length} demo jobs available`);
  return filterJobs(allJobs, { keyword, location, category });
}

function filterJobs(jobs, { keyword, location, category }) {
  let filtered = [...jobs];

  if (keyword && keyword.trim()) {
    const kw = keyword.toLowerCase().trim();
    filtered = filtered.filter(j =>
      j.title.toLowerCase().includes(kw) ||
      j.company.toLowerCase().includes(kw) ||
      (j.description || '').toLowerCase().includes(kw) ||
      (j.requirements || '').toLowerCase().includes(kw) ||
      (j.district || '').toLowerCase().includes(kw) ||
      (j.category || '').toLowerCase().includes(kw)
    );
  }

  if (location && location !== 'all') {
    const loc = location.toLowerCase();
    filtered = filtered.filter(j =>
      (j.location || '').toLowerCase().includes(loc) ||
      (j.district || '').toLowerCase().includes(loc)
    );
  }

  if (category && category !== 'all') {
    const cat = category.toLowerCase();
    filtered = filtered.filter(j =>
      (j.category || '').toLowerCase().includes(cat) ||
      (j.title || '').toLowerCase().includes(cat)
    );
  }

  return filtered;
}

/** Trả về danh sách nguồn */
export function getExternalSources() {
  return SOURCES.filter(s => s.enabled).map(s => ({
    id: s.id,
    name: s.name,
    color: s.color,
    logo: s.logo,
    baseUrl: s.baseUrl,
    verified: s.verified,
    tagline: s.tagline
  }));
}

/** Xóa cache thủ công */
export function clearAggregatorCache() {
  _cache = null;
  _cacheTime = 0;
}

export default {
  fetchExternalJobs,
  getExternalSources,
  clearAggregatorCache
};

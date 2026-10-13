import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  PlusCircle, 
  Flame, 
  Pin, 
  Users, 
  CheckCircle2, 
  FileText, 
  Trash2, 
  Phone, 
  Mail, 
  Eye, 
  MessageSquare, 
  BarChart2, 
  TrendingUp, 
  Target, 
  ArrowUpRight,
  ShieldCheck,
  Edit3,
  Search,
  Copy,
  Check,
  AlertTriangle,
  Package,
  Navigation,
  MapPin,
  Briefcase,
  X,
  Download
} from 'lucide-react';
import { soundFx } from '../services/soundEffects';
import { apiGetProjectProposals } from '../services/api';

import { API_BASE } from '../config/apiBase.js';

export default function EmployerDashboard() {
  const { 
    jobs, 
    postNewJob, 
    boostJob, 
    applications, 
    updateApplicationStatus, 
    setActiveChatRecipient, 
    deleteJob,
    setEditingJob,
    gigTasks,
    setEditingGig,
    deleteGig,
    freelanceProjects,
    createFreelanceProject,
    updateFreelanceProject,
    deleteFreelanceProject,
    currentUser,
    showToast 
  } = useApp();

  const [activeTab, setActiveTab] = useState('manage'); // 'manage' | 'applicants' | 'gigs' | 'freelance' | 'post' | 'analytics'
  const [selectedJobIdForApplicants, setSelectedJobIdForApplicants] = useState('ALL');
  const [applicantStatusFilter, setApplicantStatusFilter] = useState('ALL');
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [jobToDelete, setJobToDelete] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Gigs & Freelance states
  const [gigSearchTerm, setGigSearchTerm] = useState('');
  const [gigStatusFilter, setGigStatusFilter] = useState('ALL');
  const [freelanceSearchTerm, setFreelanceSearchTerm] = useState('');
  const [freelanceStatusFilter, setFreelanceStatusFilter] = useState('ALL');
  const [viewingProposalsProject, setViewingProposalsProject] = useState(null);
  const [proposalsList, setProposalsList] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [isCreatingFreelance, setIsCreatingFreelance] = useState(false);
  const [editingFreelanceProject, setEditingFreelanceProject] = useState(null);
  const [freelanceForm, setFreelanceForm] = useState({
    title: '',
    budget: '5.000.000đ',
    budgetNum: 5000000,
    duration: '2 tuần',
    category: 'Công nghệ / IT',
    skills: 'React, Node.js',
    deadline: '2026-10-31',
    description: '',
    hashtags: '#freelance #react #web'
  });

  const isMasterAdmin = currentUser?.role === 'admin';

  // Scope gigs: employer sees only their own gigs; admin sees all
  const myGigs = gigTasks.filter(g => 
    isMasterAdmin || (
      currentUser?.role === 'employer' && Boolean(currentUser?.id) && (
        (Boolean(g.employerId) && g.employerId === currentUser.id) || 
        (Boolean(g.employer_id) && g.employer_id === currentUser.id)
      )
    )
  );

  // Scope freelance projects: employer sees only their own; admin sees all
  const myFreelanceProjects = freelanceProjects.filter(p => 
    isMasterAdmin || (
      currentUser?.role === 'employer' && Boolean(currentUser?.id) && (
        (Boolean(p.employerId) && p.employerId === currentUser.id) || 
        (Boolean(p.employer_id) && p.employer_id === currentUser.id)
      )
    )
  );

  // Scope jobs: employer sees only their own jobs; admin sees all
  const myEmployerJobs = jobs.filter(j => 
    isMasterAdmin || (
      currentUser?.role === 'employer' && Boolean(currentUser?.id) && (
        (Boolean(j.employerId) && j.employerId === currentUser.id) || 
        (Boolean(j.employer_id) && j.employer_id === currentUser.id) ||
        (Boolean(j.company) && Boolean(currentUser?.name) && j.company.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
    )
  );

  // Filtered jobs by search term
  const displayedJobs = myEmployerJobs.filter(j => {
    if (!jobSearchTerm.trim()) return true;
    const term = jobSearchTerm.toLowerCase().trim();
    return (
      j.title.toLowerCase().includes(term) ||
      (j.category && j.category.toLowerCase().includes(term)) ||
      (j.district && j.district.toLowerCase().includes(term))
    );
  });

  // Scope applications: employer sees only applications to their jobs
  const myJobIds = new Set(myEmployerJobs.map(j => j.id));
  const myApplications = (isMasterAdmin 
    ? applications 
    : applications.filter(app => 
        myJobIds.has(app.jobId) || 
        (Boolean(app.company) && Boolean(currentUser?.name) && app.company.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
  ).slice().sort((a, b) => (b.id > a.id ? 1 : -1));

  // Filtered applications by job selector AND status filter
  const filteredApps = myApplications.filter(app => {
    const matchJob = selectedJobIdForApplicants === 'ALL' || app.jobId === selectedJobIdForApplicants;
    const matchStatus = applicantStatusFilter === 'ALL' || app.status === applicantStatusFilter;
    return matchJob && matchStatus;
  });

  const handleCopyText = (text, fieldKey, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldKey);
    showToast(`Đã sao chép ${label}: ${text}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // New Job Form State - default to logged in employer info
  const [form, setForm] = useState(() => ({
    title: '',
    company: currentUser?.name || 'Doanh nghiệp của bạn',
    companyLogo: '🏢',
    category: 'F&B',
    jobType: 'PART_TIME',
    district: currentUser?.district || 'Cầu Giấy',
    city: 'Hà Nội',
    address: '',
    salaryDisplay: '35.000đ - 40.000đ/giờ',
    salaryType: 'hourly',
    salaryMin: 35000,
    salaryMax: 40000,
    timeShift: 'Tối',
    timeHours: '18:00 - 23:00',
    experience: 'NO_EXPERIENCE',
    slots: 3,
    deadline: '2026-10-31',
    description: '',
    requirements: 'Thân thiện, đúng giờ, có trách nhiệm, không cần kinh nghiệm',
    benefits: 'Bao ăn nhẹ giữa ca, giảm 50% menu đồ uống, thưởng chuyên cần',
    hashtags: '#phucvu #parttime #caugiay #sinhvien',
    isHot: false,
    isPinned: false
  }));

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Vui lòng nhập tiêu đề công việc!', 'error');
      return;
    }

    const hashtagArray = form.hashtags
      .split(' ')
      .filter(Boolean)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`);

    const reqArray = form.requirements.split(',').map(r => r.trim()).filter(Boolean);
    const benArray = form.benefits.split(',').map(b => b.trim()).filter(Boolean);

    await postNewJob({
      ...form,
      employerId: currentUser?.id || 'user-employer-1',
      employer_id: currentUser?.id || 'user-employer-1',
      company: currentUser?.name || form.company || 'Doanh nghiệp tuyển dụng',
      requirements: reqArray,
      benefits: benArray,
      hashtags: hashtagArray,
      slots: Number(form.slots) || 1
    });

    setActiveTab('manage');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 via-indigo-950/50 to-slate-900 border border-purple-500/30 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              Cổng thông tin Nhà Tuyển Dụng & Doanh Nghiệp
            </div>
            {isMasterAdmin ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Chế độ Quản trị viên (Toàn sàn)
              </span>
            ) : currentUser?.name ? (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold">
                Đơn vị: <strong className="text-white">{currentUser.name}</strong>
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Kênh Quản Lý Tuyển Dụng WorkLink
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Đăng tin tuyển dụng nhanh, tiếp cận ứng viên sinh viên & việc làm xung quanh trong 5 phút
          </p>
        </div>

        <button
          onClick={() => setActiveTab('post')}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 active:scale-95 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Đăng tin mới</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('manage')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'manage'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          📋 Tin đã đăng ({myEmployerJobs.length})
        </button>

        <button
          onClick={() => setActiveTab('applicants')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
            activeTab === 'applicants'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          👥 Danh sách Ứng viên ({myApplications.length})
        </button>

        <button
          onClick={() => setActiveTab('gigs')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'gigs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🛵 Quản lý Việc vặt ({myGigs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('freelance')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'freelance'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>💼 Dự án Freelance ({myFreelanceProjects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('post')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'post'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          ✏️ Đăng tin tuyển dụng
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'analytics'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          📈 Thống kê & Phân tích
        </button>
      </div>

      {/* TAB 1: MANAGE POSTED JOBS */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Danh sách tin tuyển dụng ({myEmployerJobs.length})
              </h3>
              <span className="text-xs text-slate-400">Quản lý, chỉnh sửa nội dung, đẩy tin Hot hoặc xem ứng viên nộp hồ sơ</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={jobSearchTerm}
                  onChange={e => setJobSearchTerm(e.target.value)}
                  placeholder="Tìm theo tiêu đề, ngành nghề..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                onClick={() => setActiveTab('post')}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Đăng tin</span>
              </button>
            </div>
          </div>

          {displayedJobs.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white mb-1">
                {myEmployerJobs.length === 0 ? 'Chưa có tin tuyển dụng nào' : 'Không tìm thấy tin phù hợp'}
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                {myEmployerJobs.length === 0 
                  ? 'Bạn chưa đăng tin nào cho tài khoản này. Hãy bắt đầu ngay để tiếp cận ứng viên sinh viên!'
                  : 'Hãy thử đổi từ khóa tìm kiếm khác.'}
              </p>
              {myEmployerJobs.length === 0 && (
                <button
                  onClick={() => setActiveTab('post')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Đăng tin tuyển dụng đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {displayedJobs.map((job) => (
              <div
                key={job.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0">
                    {job.companyLogo || '💼'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-base font-bold text-white">{job.title}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {job.category}
                      </span>
                      {job.isPinned && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white">
                          Đã ghim
                        </span>
                      )}
                      {job.isHot && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white flex items-center gap-0.5">
                          <Flame className="w-3 h-3" /> Tin Hot
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {job.company} • {job.district}, {job.city} • Lương: <strong className="text-indigo-300">{job.salaryDisplay}</strong>
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 flex-wrap">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-slate-500" /> {job.views || 0} lượt xem</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-500" /> {job.applicationsCount || 0} hồ sơ</span>
                      <span>Hạn: {job.deadline || 'Không giới hạn'}</span>
                    </div>
                  </div>
                </div>

                {/* Boost, Sửa, Ứng viên, Xóa */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800 flex-wrap">
                  {/* Boost: Chỉ Admin/isMasterAdmin mới có quyền gọi /api/jobs/:id/boost */}
                  {isMasterAdmin && (
                    <>
                      {!job.isHot && (
                        <button
                          onClick={() => boostJob(job.id, 'hot')}
                          className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Đẩy tin lên mục Việc Hot 🔥"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>Đẩy Hot</span>
                        </button>
                      )}

                      {!job.isPinned && (
                        <button
                          onClick={() => boostJob(job.id, 'pin')}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Ghim tin đầu trang"
                        >
                          <Pin className="w-3.5 h-3.5" />
                          <span>Ghim</span>
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => {
                      soundFx.playPop();
                      setEditingJob(job);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="Chỉnh sửa chi tiết tin tuyển dụng này"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sửa tin</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedJobIdForApplicants(job.id);
                      setActiveTab('applicants');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Ứng viên ({job.applicationsCount || 0})</span>
                  </button>

                  <button
                    onClick={() => setJobToDelete(job)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Xóa tin tuyển dụng"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* TAB 2: APPLICANTS MANAGEMENT */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Quản lý hồ sơ ứng viên ({filteredApps.length}/{myApplications.length})
              </h3>
              <span className="text-xs text-slate-400">Xem xét hồ sơ, hẹn phỏng vấn hoặc trao đổi trực tiếp với ứng viên</span>
            </div>
            
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-slate-400">Lọc theo việc:</span>
              <select
                value={selectedJobIdForApplicants}
                onChange={(e) => setSelectedJobIdForApplicants(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs max-w-[200px] truncate"
              >
                <option value="ALL">Tất cả công việc ({myApplications.length})</option>
                {myEmployerJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'Tất cả trạng thái' },
              { id: 'pending', label: '⏳ Chờ duyệt' },
              { id: 'reviewed', label: '👀 Đã xem hồ sơ' },
              { id: 'interview', label: '🎉 Mời phỏng vấn' },
              { id: 'rejected', label: '❌ Đã từ chối' }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setApplicantStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  applicantStatusFilter === st.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {filteredApps.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">Không có hồ sơ nào phù hợp với bộ lọc hiện tại</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base font-extrabold text-white">{app.applicantName}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        app.status === 'interview' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        app.status === 'reviewed' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                        app.status === 'rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {app.status === 'interview' ? '🎉 Mời phỏng vấn' : 
                         app.status === 'reviewed' ? '👀 Đã xem hồ sơ' :
                         app.status === 'rejected' ? '❌ Đã từ chối' : '⏳ Chờ duyệt'}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-indigo-400 mb-1">
                      Ứng tuyển: {app.jobTitle}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-2 flex-wrap">
                      <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{app.phone}</span>
                        <button
                          onClick={() => handleCopyText(app.phone, `phone-${app.id}`, 'SĐT')}
                          className="text-slate-500 hover:text-white ml-1 cursor-pointer"
                          title="Sao chép số điện thoại"
                        >
                          {copiedField === `phone-${app.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </span>

                      {app.email && (
                        <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          <Mail className="w-3 h-3 text-indigo-400" />
                          <span>{app.email}</span>
                          <button
                            onClick={() => handleCopyText(app.email, `email-${app.id}`, 'Email')}
                            className="text-slate-500 hover:text-white ml-1 cursor-pointer"
                            title="Sao chép Email"
                          >
                            {copiedField === `email-${app.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </span>
                      )}

                      {app.hasCv || app.cvFilePath ? (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/api/applications/${app.id}/cv`, {
                                credentials: 'include'
                              });
                              if (!res.ok) throw new Error('Không thể tải file CV');
                              const blob = await res.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = app.cvName || 'CV_UngVien.pdf';
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              window.URL.revokeObjectURL(url);
                              showToast('Đang tải file CV...', 'success');
                            } catch (err) {
                              showToast(err.message || 'Lỗi tải CV', 'error');
                            }
                          }}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-medium"
                          title="Bấm để tải file CV của ứng viên"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-400" /> {app.cvName || 'CV_DinhKem.pdf'}
                          <Download className="w-3 h-3 ml-0.5" />
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                          <FileText className="w-3.5 h-3.5 text-slate-500" /> {app.cvName || 'CV_DinhKem.pdf'}
                        </span>
                      )}
                      <span className="text-slate-500">• Nộp lúc: {app.appliedAt}</span>
                    </div>

                    {app.note && (
                      <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                        💬 "{app.note}"
                      </p>
                    )}
                  </div>

                  {/* Status & Chat buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        soundFx.playPop();
                        setActiveChatRecipient({
                          name: app.applicantName,
                          phone: app.phone,
                          email: app.email,
                          jobTitle: app.jobTitle,
                          threadId: `thread_app_${app.id}`
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                      title="Nhắn tin trực tiếp với ứng viên"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Nhắn tin
                    </button>
                    <button
                      onClick={() => {
                        soundFx.playPop();
                        updateApplicationStatus(app.id, 'reviewed');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      Đã xem
                    </button>
                    <button
                      onClick={() => {
                        soundFx.playSuccess();
                        updateApplicationStatus(app.id, 'interview');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mời phỏng vấn
                    </button>
                    <button
                      onClick={() => {
                        soundFx.playPop();
                        updateApplicationStatus(app.id, 'rejected');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANAGE GIGS (VIỆC VẶT & GIAO HÀNG GRAB-STYLE) */}
      {activeTab === 'gigs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                Quản lý Cuốc Việc Vặt & Giao Hàng ({myGigs.length})
              </h3>
              <span className="text-xs text-slate-400">
                Phát lệnh cuốc giao hàng tức thì, bản đồ lộ trình GPS và giám sát tài xế nhận cuốc theo thời gian thực
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={gigSearchTerm}
                  onChange={e => setGigSearchTerm(e.target.value)}
                  placeholder="Tìm việc vặt, món hàng, địa điểm..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => {
                  soundFx.playPop();
                  setEditingGig({ isNew: true });
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 whitespace-nowrap cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Đăng việc vặt mới</span>
              </button>
            </div>
          </div>

          {/* Filter Status Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'ALL', label: `Tất cả (${myGigs.length})` },
              { id: 'AVAILABLE', label: `🟢 Chờ nhận (${myGigs.filter(g => g.status === 'AVAILABLE').length})` },
              { id: 'ACCEPTED', label: `🟡 Đang thực hiện (${myGigs.filter(g => g.status === 'ACCEPTED').length})` },
              { id: 'COMPLETED', label: `🔵 Hoàn thành (${myGigs.filter(g => g.status === 'COMPLETED').length})` }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setGigStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  gigStatusFilter === st.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Gigs List */}
          {(() => {
            const filteredGigs = myGigs.filter(g => {
              const q = (gigSearchTerm || '').toLowerCase().trim();
              const matchSearch = !q || 
                g.title.toLowerCase().includes(q) || 
                (g.cargoType && g.cargoType.toLowerCase().includes(q)) ||
                (g.pickupLocation?.name && g.pickupLocation.name.toLowerCase().includes(q)) ||
                (g.dropoffLocation?.name && g.dropoffLocation.name.toLowerCase().includes(q));
              const matchStatus = gigStatusFilter === 'ALL' || g.status === gigStatusFilter;
              return matchSearch && matchStatus;
            });

            if (filteredGigs.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
                  <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-white mb-1">
                    {myGigs.length === 0 ? 'Chưa có cuốc việc vặt nào được đăng' : 'Không tìm thấy việc vặt phù hợp'}
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    {myGigs.length === 0 
                      ? 'Bạn có thể đăng cuốc giao tài liệu, đồ ăn, hoặc chạy việc vặt với bản đồ GPS như Grab Express ngay bây giờ!'
                      : 'Hãy thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái.'}
                  </p>
                  {myGigs.length === 0 && (
                    <button
                      onClick={() => setEditingGig({ isNew: true })}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30"
                    >
                      <PlusCircle className="w-4 h-4" /> Đăng việc vặt đầu tiên
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-4">
                {filteredGigs.map(gig => (
                  <div
                    key={gig.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-3 flex-1">
                      {/* Title & Status Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          gig.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse' :
                          gig.status === 'ACCEPTED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {gig.status === 'AVAILABLE' ? '🟢 Đang tìm tài xế / người nhận' :
                           gig.status === 'ACCEPTED' ? `🟡 Đang thực hiện (${gig.acceptedByName || 'Ứng viên'})` :
                           '🔵 Hoàn thành'}
                        </span>

                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">
                          {gig.cargoType || 'Tài liệu / Đồ nhỏ'}
                        </span>

                        {gig.isValuable && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-semibold">
                            💎 Hàng giá trị cao
                          </span>
                        )}

                        {gig.requiresContract && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">
                            📜 Cần ký hợp đồng
                          </span>
                        )}

                        <span className="text-slate-500 text-[11px]">ID: {gig.id}</span>
                      </div>

                      <h4 className="text-base font-extrabold text-white">
                        {gig.title}
                      </h4>

                      {/* Lộ trình Grab-style */}
                      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold flex items-center gap-1 w-20 flex-shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Điểm lấy:
                          </span>
                          <span className="text-white font-medium">{gig.pickupLocation?.name}</span>
                          <span className="text-slate-400 text-[11px]">({gig.pickupLocation?.address || gig.pickupLocation?.name})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-bold flex items-center gap-1 w-20 flex-shrink-0">
                            <Navigation className="w-3.5 h-3.5 text-rose-400" /> Điểm giao:
                          </span>
                          <span className="text-white font-medium">{gig.dropoffLocation?.name}</span>
                          <span className="text-slate-400 text-[11px]">({gig.dropoffLocation?.address || gig.dropoffLocation?.name})</span>
                        </div>
                        <div className="flex items-center gap-4 pt-1 border-t border-slate-900 text-[11px] text-slate-400">
                          <span>📏 Lộ trình: <strong className="text-indigo-300">{gig.distanceKm || 0} km</strong></span>
                          <span>⏱️ Thời gian cần: <strong className="text-slate-200">{gig.time || '30 phút'}</strong></span>
                          {gig.note && <span>💬 Lưu ý: <em className="text-slate-300">"{gig.note}"</em></span>}
                        </div>
                      </div>

                      {/* Người gửi & Người nhận */}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Người gửi: <strong className="text-slate-200">{gig.sender || 'Chủ cuốc'}</strong></span>
                        <span>Người nhận: <strong className="text-slate-200">{gig.receiver || 'Chưa cập nhật'}</strong></span>
                        {gig.acceptedBy && (
                          <span className="text-amber-400 font-medium">
                            Người thực hiện: <strong>{gig.acceptedByName || gig.acceptedBy}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reward & Action Buttons */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Phần thưởng cuốc</span>
                        <span className="text-xl font-black text-emerald-400">{gig.reward}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {gig.status === 'ACCEPTED' && (
                          <button
                            onClick={() => {
                              soundFx.playPop();
                              setActiveChatRecipient({
                                name: gig.acceptedByName || 'Người nhận việc',
                                role: 'job_seeker',
                                threadId: `thread_gig_${gig.id}`
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Nhắn tin</span>
                          </button>
                        )}

                        <button
                          disabled={gig.status === 'COMPLETED'}
                          onClick={() => {
                            if (gig.status === 'COMPLETED') {
                              showToast('Không thể chỉnh sửa việc vặt đã hoàn thành!', 'error');
                              return;
                            }
                            soundFx.playPop();
                            setEditingGig(gig);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                            gig.status === 'COMPLETED'
                              ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
                          }`}
                          title={gig.status === 'COMPLETED' ? 'Không thể chỉnh sửa việc vặt đã hoàn thành' : 'Chỉnh sửa việc vặt'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>

                        <button
                          disabled={gig.status === 'ACCEPTED' || gig.status === 'COMPLETED'}
                          onClick={async () => {
                            if (gig.status === 'ACCEPTED' || gig.status === 'COMPLETED') {
                              showToast(`Không thể xóa việc vặt đã ở trạng thái ${gig.status === 'ACCEPTED' ? 'ĐANG THỰC HIỆN' : 'HOÀN THÀNH'}!`, 'error');
                              return;
                            }
                            if (window.confirm(`Bạn có chắc chắn muốn xóa việc vặt "${gig.title}"?`)) {
                              soundFx.playPop();
                              await deleteGig(gig.id);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                            gig.status === 'ACCEPTED' || gig.status === 'COMPLETED'
                              ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer'
                          }`}
                          title={gig.status !== 'AVAILABLE' ? 'Không thể xóa việc vặt đã có người nhận hoặc đã kết thúc' : 'Xóa việc vặt'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 4: MANAGE FREELANCE PROJECTS */}
      {activeTab === 'freelance' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-400" />
                Quản lý Dự án Freelance ({myFreelanceProjects.length})
              </h3>
              <span className="text-xs text-slate-400">
                Đăng bài gọi thầu, nhận báo giá từ các Freelancer và quản lý tiến độ dự án
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={freelanceSearchTerm}
                  onChange={e => setFreelanceSearchTerm(e.target.value)}
                  placeholder="Tìm theo tiêu đề, kỹ năng..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => {
                  soundFx.playPop();
                  setIsCreatingFreelance(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/30 whitespace-nowrap cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Đăng dự án Freelance</span>
              </button>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'ALL', label: `Tất cả (${myFreelanceProjects.length})` },
              { id: 'OPEN', label: `🟢 Đang nhận thầu (${myFreelanceProjects.filter(p => p.status === 'OPEN').length})` },
              { id: 'CLOSED', label: `🔒 Đã đóng (${myFreelanceProjects.filter(p => p.status === 'CLOSED').length})` }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setFreelanceStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  freelanceStatusFilter === st.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Freelance Projects List */}
          {(() => {
            const filteredFl = myFreelanceProjects.filter(p => {
              const q = (freelanceSearchTerm || '').toLowerCase().trim();
              const matchSearch = !q || 
                p.title.toLowerCase().includes(q) || 
                (p.category && p.category.toLowerCase().includes(q)) ||
                (p.skills && p.skills.some(s => s.toLowerCase().includes(q)));
              const matchStatus = freelanceStatusFilter === 'ALL' || p.status === freelanceStatusFilter;
              return matchSearch && matchStatus;
            });

            if (filteredFl.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
                  <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-white mb-1">
                    {myFreelanceProjects.length === 0 ? 'Chưa có dự án Freelance nào được đăng' : 'Không tìm thấy dự án phù hợp'}
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    {myFreelanceProjects.length === 0 
                      ? 'Bạn có nhu cầu thuê lập trình viên, designer, content writer? Đăng dự án ngay để nhận các báo giá chào thầu cạnh tranh!'
                      : 'Hãy thử đổi từ khóa tìm kiếm.'}
                  </p>
                  {myFreelanceProjects.length === 0 && (
                    <button
                      onClick={() => setIsCreatingFreelance(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/30"
                    >
                      <PlusCircle className="w-4 h-4" /> Đăng dự án đầu tiên
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-4">
                {filteredFl.map(project => (
                  <div
                    key={project.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          project.status === 'OPEN'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {project.status === 'OPEN' ? '🟢 Đang mở nhận chào thầu' : '🔒 Đã đóng'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">
                          {project.category || 'Công nghệ'}
                        </span>
                        <span className="text-slate-500 text-[11px]">ID: {project.id}</span>
                      </div>

                      <h4 className="text-base font-extrabold text-white">
                        {project.title}
                      </h4>

                      <p className="text-xs text-slate-400 line-clamp-2">
                        {project.description || 'Không có mô tả chi tiết'}
                      </p>

                      {/* Required skills */}
                      {project.skills && project.skills.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {project.skills.map((sk, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/40 text-[11px] text-blue-300">
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                        <span>Thời hạn: <strong className="text-slate-200">{project.duration}</strong></span>
                        <span>Hạn chót: <strong className="text-slate-200">{project.deadline}</strong></span>
                        <span className="text-indigo-400 font-bold">
                          📩 {project.proposalsCount || 0} đề xuất chào thầu
                        </span>
                      </div>
                    </div>

                    {/* Right side: Budget & Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Ngân sách dự án</span>
                        <span className="text-xl font-black text-blue-400">{project.budget}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={async () => {
                            soundFx.playPop();
                            setViewingProposalsProject(project);
                            setLoadingProposals(true);
                            try {
                              const res = await apiGetProjectProposals(project.id);
                              setProposalsList(res?.proposals || []);
                            } catch (err) {
                              showToast('Lỗi khi tải đề xuất: ' + err.message, 'error');
                            } finally {
                              setLoadingProposals(false);
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem chào thầu ({project.proposalsCount || 0})</span>
                        </button>

                        <button
                          onClick={() => {
                            soundFx.playPop();
                            setEditingFreelanceProject(project);
                            setFreelanceForm({
                              title: project.title || '',
                              budget: project.budget || '5.000.000đ',
                              budgetNum: project.budgetNum || 5000000,
                              duration: project.duration || '2 tuần',
                              category: project.category || 'Công nghệ / IT',
                              skills: Array.isArray(project.skills) ? project.skills.join(', ') : (project.skills || ''),
                              deadline: project.deadline || '',
                              description: project.description || '',
                              hashtags: Array.isArray(project.hashtags) ? project.hashtags.join(' ') : (project.hashtags || '')
                            });
                            setIsCreatingFreelance(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                          title="Chỉnh sửa thông tin dự án"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>

                        <button
                          onClick={async () => {
                            soundFx.playPop();
                            const newStatus = project.status === 'OPEN' ? 'CLOSED' : 'OPEN';
                            await updateFreelanceProject(project.id, { status: newStatus });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-all"
                          title={project.status === 'OPEN' ? 'Đóng nhận đề xuất' : 'Mở lại nhận đề xuất'}
                        >
                          {project.status === 'OPEN' ? '🔒 Đóng' : '🔓 Mở lại'}
                        </button>

                        <button
                          onClick={async () => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa dự án "${project.title}" và toàn bộ đề xuất liên quan?`)) {
                              soundFx.playPop();
                              await deleteFreelanceProject(project.id);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 5: CREATE NEW JOB FORM */}
      {activeTab === 'post' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 max-w-3xl mx-auto shadow-2xl">
          <h3 className="text-xl font-extrabold text-white mb-1">Đăng tin tuyển dụng mới</h3>
          <p className="text-xs text-slate-400 mb-6">Điền đầy đủ thông tin để AI phân tích và đề xuất đến đúng đối tượng</p>

          <form onSubmit={handleCreateJob} className="space-y-4">
            
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Tiêu đề công việc *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="VD: Tuyển nhân viên phục vụ part-time ca tối"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Tên cơ sở / Công ty *</label>
                <input
                  type="text"
                  required
                  value={form.company}
                  onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Ngành nghề</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="F&B">F&B (Phục vụ / Barista / Bếp)</option>
                  <option value="IT">IT / Lập trình</option>
                  <option value="Bán hàng">Bán hàng / Thu ngân</option>
                  <option value="Marketing">Marketing / Content</option>
                  <option value="Gia sư">Gia sư / Dạy học</option>
                  <option value="Kho vận">Kho vận / Đóng gói</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Quận / Huyện *</label>
                <select
                  value={form.district}
                  onChange={(e) => setForm(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Cầu Giấy">Cầu Giấy</option>
                  <option value="Đống Đa">Đống Đa</option>
                  <option value="Hai Bà Trưng">Hai Bà Trưng</option>
                  <option value="Thanh Xuân">Thanh Xuân</option>
                  <option value="Nam Từ Liêm">Nam Từ Liêm</option>
                  <option value="Bắc Từ Liêm">Bắc Từ Liêm</option>
                  <option value="Ba Đình">Ba Đình</option>
                  <option value="Hoàn Kiếm">Hoàn Kiếm</option>
                  <option value="Hoàng Mai">Hoàng Mai</option>
                  <option value="Tây Hồ">Tây Hồ</option>
                  <option value="Hà Đông">Hà Đông</option>
                  <option value="Long Biên">Long Biên</option>
                  <option value="Gia Lâm">Gia Lâm</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Hình thức</label>
                <select
                  value={form.jobType}
                  onChange={(e) => setForm(prev => ({ ...prev, jobType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="PART_TIME">Part-time (Bán thời gian)</option>
                  <option value="FULL_TIME">Full-time (Chính thức)</option>
                  <option value="INTERN">Thực tập sinh (Intern)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Ca làm việc</label>
                <select
                  value={form.timeShift}
                  onChange={(e) => setForm(prev => ({ ...prev, timeShift: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Tối">Ca Tối</option>
                  <option value="Sáng">Ca Sáng</option>
                  <option value="Chiều">Ca Chiều</option>
                  <option value="Linh hoạt">Linh hoạt</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Mức lương hiển thị *</label>
                <input
                  type="text"
                  required
                  value={form.salaryDisplay}
                  onChange={(e) => setForm(prev => ({ ...prev, salaryDisplay: e.target.value }))}
                  placeholder="30.000đ - 40.000đ/giờ"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Khung giờ làm chi tiết</label>
                <input
                  type="text"
                  value={form.timeHours}
                  onChange={(e) => setForm(prev => ({ ...prev, timeHours: e.target.value }))}
                  placeholder="17:00 - 22:30"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Mô tả công việc</label>
              <textarea
                rows="3"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả chi tiết công việc, môi trường quán, yêu cầu cơ bản..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Hashtags (phục vụ tìm kiếm nhanh)</label>
              <input
                type="text"
                value={form.hashtags}
                onChange={(e) => setForm(prev => ({ ...prev, hashtags: e.target.value }))}
                placeholder="#phucvu #parttime #caugiay #sinhvien"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Monetization Boost Promotion Checkboxes */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
              <span className="text-xs font-bold text-indigo-300 block">
                ⭐ Tùy chọn Quảng bá tin (Monetization Simulation):
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.isHot}
                  onChange={(e) => setForm(prev => ({ ...prev, isHot: e.target.checked }))}
                  className="w-4 h-4 rounded text-orange-500 focus:ring-0"
                />
                <span className="flex items-center gap-1 font-semibold">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Gắn huy hiệu Tin Hot 🔥 (Xuất hiện trên mục Hot Feed Reels)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => setForm(prev => ({ ...prev, isPinned: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-500 focus:ring-0"
                />
                <span className="flex items-center gap-1 font-semibold">
                  <Pin className="w-3.5 h-3.5 text-indigo-400" />
                  Ghim tin lên đầu trang kết quả tìm kiếm
                </span>
              </label>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all active:scale-98 cursor-pointer"
              >
                Xác nhận đăng tin tuyển dụng
              </button>
            </div>

          </form>
        </div>
      )}

      {/* TAB 4: ANALYTICS */}
      {activeTab === 'analytics' && (() => {
        // Compute analytics from scoped employer state
        const totalViews = myEmployerJobs.reduce((s, j) => s + (j.views || 0), 0);
        const totalApps = myApplications.length;
        const conversionRate = totalViews > 0 ? ((totalApps / totalViews) * 100).toFixed(1) : 0;
        const hotCount = myEmployerJobs.filter(j => j.isHot).length;

        const statusCounts = {
          pending:  myApplications.filter(a => a.status === 'pending').length,
          reviewed: myApplications.filter(a => a.status === 'reviewed').length,
          interview:myApplications.filter(a => a.status === 'interview').length,
          rejected: myApplications.filter(a => a.status === 'rejected').length,
        };

        // Per-job stats
        const jobStats = myEmployerJobs.map(j => ({
          ...j,
          appCount: myApplications.filter(a => a.jobId === j.id).length,
          interviewCount: myApplications.filter(a => a.jobId === j.id && a.status === 'interview').length,
          rate: (j.views || 0) > 0
            ? ((myApplications.filter(a => a.jobId === j.id).length / (j.views || 1)) * 100).toFixed(1)
            : '0.0'
        })).sort((a, b) => b.appCount - a.appCount);

        const maxApps = Math.max(...jobStats.map(j => j.appCount), 1);

        return (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Tổng lượt xem', value: totalViews.toLocaleString(), icon: Eye, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
                { label: 'Tổng hồ sơ nhận', value: totalApps, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                { label: 'Tỷ lệ ứng tuyển', value: `${conversionRate}%`, icon: Target, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                { label: 'Tin đang Hot 🔥', value: hotCount, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`p-5 rounded-2xl bg-slate-900 border ${stat.border} flex items-center gap-3`}>
                    <div className={`w-11 h-11 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">{stat.label}</p>
                      <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Per-job performance table */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800">
                <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  Hiệu suất từng tin đăng
                </h3>
                {jobStats.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-8">Chưa có tin đăng nào</p>
                ) : (
                  <div className="space-y-3">
                    {jobStats.map(job => (
                      <div key={job.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg flex-shrink-0">{job.companyLogo || '💼'}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{job.title}</p>
                              <p className="text-[10px] text-slate-400">{job.district} • {job.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 text-[11px]">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Eye className="w-3 h-3" />{job.views || 0}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400 font-bold">
                              <Users className="w-3 h-3" />{job.appCount}
                            </span>
                            {job.interviewCount > 0 && (
                              <span className="flex items-center gap-1 text-amber-400 font-bold">
                                <CheckCircle2 className="w-3 h-3" />{job.interviewCount} PV
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Progress bar: app rate vs max */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-700"
                              style={{ width: `${(job.appCount / maxApps) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 w-12 text-right">{job.rate}% CR</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right column: funnel + top performer */}
              <div className="space-y-4">
                {/* Application Funnel */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800">
                  <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Phễu tuyển dụng
                  </h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'Chờ xử lý', count: statusCounts.pending, color: 'bg-amber-500', text: 'text-amber-400' },
                      { label: 'Đã xem', count: statusCounts.reviewed, color: 'bg-indigo-500', text: 'text-indigo-400' },
                      { label: 'Mời phỏng vấn', count: statusCounts.interview, color: 'bg-emerald-500', text: 'text-emerald-400' },
                      { label: 'Từ chối', count: statusCounts.rejected, color: 'bg-rose-500', text: 'text-rose-400' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="w-24 text-slate-400 flex-shrink-0">{s.label}</span>
                        <div className="flex-1 h-5 rounded-lg bg-slate-800 overflow-hidden relative">
                          <div
                            className={`h-5 rounded-lg ${s.color} transition-all duration-700`}
                            style={{ width: totalApps > 0 ? `${(s.count / totalApps) * 100}%` : '0%' }}
                          />
                          {s.count > 0 && (
                            <span className="absolute inset-0 flex items-center justify-start pl-2 text-white font-bold text-[10px]">
                              {s.count}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top performer job */}
                {jobStats[0] && jobStats[0].appCount > 0 && (
                  <div className="p-5 rounded-3xl bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-500/30">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" /> Tin hiệu quả nhất
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{jobStats[0].companyLogo || '💼'}</span>
                      <p className="text-sm font-black text-white leading-tight">{jobStats[0].title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-slate-900/80 text-center">
                        <p className="text-emerald-400 font-black text-lg">{jobStats[0].appCount}</p>
                        <p className="text-slate-400">hồ sơ</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 text-center">
                        <p className="text-amber-400 font-black text-lg">{jobStats[0].rate}%</p>
                        <p className="text-slate-400">tỷ lệ CT</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {jobToDelete && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Xác nhận xóa tin tuyển dụng?</h4>
                <p className="text-xs text-slate-400">Tin đăng sẽ bị gỡ vĩnh viễn và không thể hoàn tác.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300">
              <p className="font-bold text-white mb-0.5">{jobToDelete.title}</p>
              <p className="text-slate-400">{jobToDelete.company} • {jobToDelete.district}, {jobToDelete.city}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={async () => {
                  soundFx.playPop();
                  await deleteJob(jobToDelete.id);
                  setJobToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xem danh sách đề xuất chào thầu Freelance */}
      {viewingProposalsProject && (
        <div 
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setViewingProposalsProject(null)}
        >
          <div 
            className="w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-blue-500/30 rounded-3xl p-6 shadow-2xl flex flex-col text-left space-y-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  Danh sách đề xuất chào thầu
                </h4>
                <p className="text-xs text-slate-400">
                  Dự án: <strong className="text-blue-300">{viewingProposalsProject.title}</strong> • Ngân sách: <strong className="text-emerald-400">{viewingProposalsProject.budget}</strong>
                </p>
              </div>
              <button
                onClick={() => setViewingProposalsProject(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingProposals ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Đang tải danh sách chào thầu từ máy chủ...
                </div>
              ) : proposalsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Chưa có Freelancer nào gửi đề xuất chào thầu cho dự án này.
                </div>
              ) : (
                proposalsList.map(prop => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm">{prop.applicant_name || prop.applicantName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({prop.user_id || prop.userId})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          Chào thầu: {prop.bid}
                        </span>
                        <span className="text-slate-400">
                          ⏱️ {prop.duration}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-slate-300 whitespace-pre-line leading-relaxed">
                      💬 "{prop.cover}"
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span>Gửi lúc: {new Date(prop.created_at || prop.createdAt).toLocaleString('vi-VN')}</span>
                      <button
                        onClick={() => {
                          soundFx.playPop();
                          setActiveChatRecipient({
                            name: prop.applicant_name || prop.applicantName,
                            role: 'job_seeker',
                            threadId: `thread_prop_${prop.id}`
                          });
                          setViewingProposalsProject(null);
                        }}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-blue-600/30"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Nhắn tin trao đổi</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Đăng dự án Freelance mới */}
      {isCreatingFreelance && (
        <div 
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsCreatingFreelance(false)}
        >
          <div 
            className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-blue-500/30 rounded-3xl p-6 shadow-2xl flex flex-col text-left space-y-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  {editingFreelanceProject ? 'Chỉnh sửa Dự án Freelance' : 'Đăng Dự án Freelance Mới'}
                </h4>
                <p className="text-xs text-slate-400">
                  {editingFreelanceProject ? 'Cập nhật lại ngân sách, kỹ năng hoặc mô tả dự án' : 'Mô tả dự án để các Freelancer gửi chào thầu và báo giá cạnh tranh'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreatingFreelance(false);
                  setEditingFreelanceProject(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!freelanceForm.title.trim()) {
                  showToast('Vui lòng nhập tiêu đề dự án!', 'error');
                  return;
                }
                const skillsArr = freelanceForm.skills.split(',').map(s => s.trim()).filter(Boolean);
                const hashArr = freelanceForm.hashtags.split(' ').map(t => t.trim()).filter(Boolean);

                if (editingFreelanceProject) {
                  const ok = await updateFreelanceProject(editingFreelanceProject.id, {
                    ...freelanceForm,
                    skills: skillsArr,
                    hashtags: hashArr,
                    budgetNum: Number(freelanceForm.budgetNum) || 5000000
                  });
                  if (ok) {
                    setIsCreatingFreelance(false);
                    setEditingFreelanceProject(null);
                  }
                } else {
                  const ok = await createFreelanceProject({
                    ...freelanceForm,
                    skills: skillsArr,
                    hashtags: hashArr,
                    budgetNum: Number(freelanceForm.budgetNum) || 5000000
                  });
                  if (ok) {
                    setIsCreatingFreelance(false);
                    setFreelanceForm({
                      title: '',
                      budget: '5.000.000đ',
                      budgetNum: 5000000,
                      duration: '2 tuần',
                      category: 'Công nghệ / IT',
                      skills: 'React, Node.js',
                      deadline: '2026-10-31',
                      description: '',
                      hashtags: '#freelance #react #web'
                    });
                  }
                }
              }}
              className="flex-1 overflow-y-auto space-y-4 pr-1"
            >
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Tiêu đề dự án Freelance *
                </label>
                <input
                  type="text"
                  required
                  value={freelanceForm.title}
                  onChange={e => setFreelanceForm({ ...freelanceForm, title: e.target.value })}
                  placeholder="Ví dụ: Thiết kế bộ nhận diện thương hiệu & Logo cho quán Cafe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Ngân sách dự án (VNĐ) *
                  </label>
                  <input
                    type="text"
                    required
                    value={freelanceForm.budget}
                    onChange={e => {
                      const val = e.target.value;
                      const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
                      setFreelanceForm({ ...freelanceForm, budget: val, budgetNum: num });
                    }}
                    placeholder="5.000.000đ"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Thời gian thực hiện
                  </label>
                  <input
                    type="text"
                    value={freelanceForm.duration}
                    onChange={e => setFreelanceForm({ ...freelanceForm, duration: e.target.value })}
                    placeholder="VD: 2 tuần, 1 tháng..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Lĩnh vực / Danh mục
                  </label>
                  <select
                    value={freelanceForm.category}
                    onChange={e => setFreelanceForm({ ...freelanceForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Công nghệ / IT">💻 Công nghệ / IT</option>
                    <option value="Thiết kế đồ họa">🎨 Thiết kế đồ họa</option>
                    <option value="Content & Dịch thuật">✍️ Content & Dịch thuật</option>
                    <option value="Video & Âm thanh">🎬 Video & Âm thanh</option>
                    <option value="Marketing & Bán hàng">📈 Marketing & Bán hàng</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Hạn chót nhận đề xuất
                  </label>
                  <input
                    type="date"
                    value={freelanceForm.deadline}
                    onChange={e => setFreelanceForm({ ...freelanceForm, deadline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Kỹ năng yêu cầu (phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={freelanceForm.skills}
                  onChange={e => setFreelanceForm({ ...freelanceForm, skills: e.target.value })}
                  placeholder="React, TailwindCSS, Figma, UI/UX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Mô tả chi tiết yêu cầu dự án
                </label>
                <textarea
                  rows={3}
                  value={freelanceForm.description}
                  onChange={e => setFreelanceForm({ ...freelanceForm, description: e.target.value })}
                  placeholder="Mô tả cụ thể phạm vi công việc, sản phẩm bàn giao mong muốn..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFreelance(false);
                    setEditingFreelanceProject(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 cursor-pointer transition-all"
                >
                  {editingFreelanceProject ? 'Lưu thay đổi dự án' : 'Đăng dự án gọi thầu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}


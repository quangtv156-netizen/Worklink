import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  apiGetAdminUsers, 
  apiUpdateUserRole 
} from '../services/api';
import { 
  ShieldCheck, 
  Users, 
  Briefcase, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw,
  Trash2, 
  Hash,
  Flame,
  Activity,
  User,
  Building2,
  Search,
  Navigation,
  Layers,
  Pin
} from 'lucide-react';

export default function AdminDashboard() {
  const { 
    jobs, 
    boostJob,
    applications, 
    gigTasks = [], 
    freelanceProjects = [], 
    deleteJob, 
    deleteGig, 
    updateFreelanceProject, 
    deleteFreelanceProject, 
    resetDemoData, 
    showToast 
  } = useApp();

  const [adminTab, setAdminTab] = useState('overview'); // 'overview' | 'users' | 'jobs' | 'gigs' | 'freelance'
  const [gigStatusFilter, setGigStatusFilter] = useState('ALL');
  const [freelanceStatusFilter, setFreelanceStatusFilter] = useState('ALL');

  // Users state fetched from backend API
  const [userList, setUserList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    async function fetchUsers() {
      setLoadingUsers(true);
      try {
        const res = await apiGetAdminUsers();
        if (res?.users) {
          setUserList(res.users);
        }
      } catch (err) {
        // Fallback default users if API offline
        setUserList([
          { id: 'user-seeker-1', name: 'Nguyễn Minh Anh', email: 'minhanh.student@gmail.com', role: 'job_seeker', phone: '0988 123 456', district: 'Cầu Giấy', created_at: '2026-09-18' },
          { id: 'user-employer-1', name: 'The Coffee Lab & Bistro', email: 'hr@thecoffeelab.vn', role: 'employer', phone: '0912 345 678', district: 'Cầu Giấy', created_at: '2026-09-18' },
          { id: 'user-employer-2', name: 'NextGen Tech Solutions', email: 'hr@nextgentech.vn', role: 'employer', phone: '0983 888 999', district: 'Cầu Giấy', created_at: '2026-09-18' },
          { id: 'user-employer-3', name: 'VinaFintech Digital', email: 'tuyendung@vinafintech.vn', role: 'employer', phone: '0904 112 233', district: 'Nam Từ Liêm', created_at: '2026-09-18' },
          { id: 'user-employer-4', name: 'Urban Threads Studio', email: 'contact@urbanthreads.vn', role: 'employer', phone: '0936 555 777', district: 'Hai Bà Trưng', created_at: '2026-09-19' },
          { id: 'user-employer-5', name: 'Media Pulse Agency', email: 'hr@mediapulse.vn', role: 'employer', phone: '0977 223 344', district: 'Thanh Xuân', created_at: '2026-09-19' },
          { id: 'user-employer-6', name: 'Trung tâm Gia sư Khởi Sáng', email: 'giasukhoisang@gmail.com', role: 'employer', phone: '0966 889 900', district: 'Cầu Giấy', created_at: '2026-09-19' },
          { id: 'user-employer-7', name: 'FastLogistics Express', email: 'recruitment@fastlogistics.vn', role: 'employer', phone: '0944 667 788', district: 'Hoàng Mai', created_at: '2026-09-19' },
          { id: 'user-admin-1', name: 'Admin Quản Trị', email: 'admin@worklink.vn', role: 'admin', phone: '0999 999 999', district: 'Hà Nội', created_at: '2026-09-18' }
        ]);
      } finally {
        setLoadingUsers(false);
      }
    }

    fetchUsers();
  }, []);

  const handleChangeRole = async (userId, newRole) => {
    try {
      await apiUpdateUserRole(userId, newRole);
      setUserList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast(`Đã đổi vai trò người dùng thành [${newRole === 'admin' ? 'Admin' : newRole === 'employer' ? 'Nhà tuyển dụng' : 'Ứng viên'}]!`);
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật vai trò', 'error');
    }
  };

  // Real computed stats
  const categoryBreakdown = Object.entries(
    jobs.reduce((acc, j) => { 
      const cat = j.category || 'Khác';
      acc[cat] = (acc[cat] || 0) + 1; 
      return acc; 
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const statusBreakdown = [
    { label: 'Chưa xử lý', count: applications.filter(a => a.status === 'pending').length, color: 'text-amber-400' },
    { label: 'Đã xem', count: applications.filter(a => a.status === 'reviewed').length, color: 'text-indigo-400' },
    { label: 'Phỏng vấn', count: applications.filter(a => a.status === 'interview').length, color: 'text-emerald-400' },
    { label: 'Từ chối', count: applications.filter(a => a.status === 'rejected').length, color: 'text-rose-400' },
  ];

  const [reports, setReports] = useState([
    { id: 'rep-1', jobTitle: 'Tuyển gấp nhập liệu tại nhà lương 500k/ngày', reason: 'Nghi vấn lừa đảo cọc tiền', date: '2026-09-19', status: 'PENDING' },
    { id: 'rep-2', jobTitle: 'Giao hàng không rõ nguồn gốc', reason: 'Nội dung mập mờ', date: '2026-09-20', status: 'PENDING' }
  ]);

  const stats = [
    { title: 'Việc làm tuyển dụng', value: jobs.length, icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { title: 'Việc vặt Grab-style', value: gigTasks.length, icon: Navigation, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { title: 'Dự án Freelance', value: freelanceProjects.length, icon: Layers, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { title: 'Tài khoản hệ thống', value: userList.length || 3, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  ];

  const handleResolveReport = (reportId) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'RESOLVED' } : r));
    showToast('Đã xử lý và đóng báo cáo vi phạm!');
  };

  const handleRemoveJob = async (jobId) => {
    if (window.confirm('Quản trị viên xác nhận gỡ bỏ bài đăng này khỏi hệ thống?')) {
      await deleteJob(jobId);
    }
  };

  const handleRemoveGig = async (gigId) => {
    if (window.confirm('Quản trị viên xác nhận gỡ bỏ việc vặt này khỏi hệ thống?')) {
      await deleteGig(gigId);
    }
  };

  const handleRemoveFreelance = async (projectId) => {
    if (window.confirm('Quản trị viên xác nhận gỡ bỏ dự án Freelance này khỏi hệ thống?')) {
      await deleteFreelanceProject(projectId);
    }
  };

  const handleToggleFreelanceStatus = async (project) => {
    const nextStatus = project.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    await updateFreelanceProject(project.id, { status: nextStatus });
    showToast(`Đã chuyển trạng thái dự án sang [${nextStatus}]!`);
  };

  const handleResetData = () => {
    if (window.confirm('CẢNH BÁO ADMIN: Bạn có chắc chắn muốn khôi phục lại toàn bộ dữ liệu demo ban đầu không?')) {
      resetDemoData();
    }
  };

  // Filtered users
  const filteredUsers = userList.filter(u => {
    const q = (userSearch || '').toLowerCase().trim();
    const matchSearch = !q || 
      (u.name && u.name.toLowerCase().includes(q)) || 
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q));
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });


  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold mb-2 border border-rose-500/30">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            Trung tâm Quản trị Cấp cao WorkLink (RBAC Master)
          </div>
          <h1 className="text-2xl font-black text-white">Quản trị Toàn quyền & Kiểm duyệt Sàn</h1>
          <p className="text-xs text-slate-400 mt-1">Quản lý phân quyền người dùng, kiểm duyệt việc làm và giám sát an toàn nền tảng</p>
        </div>

        <button
          onClick={handleResetData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
          title="Khôi phục database về trạng thái ban đầu"
        >
          <RotateCcw className="w-4 h-4 text-indigo-400" />
          <span>Khôi phục dữ liệu mẫu</span>
        </button>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => setAdminTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminTab === 'overview'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          Tổng quan & Báo cáo
        </button>

        <button
          onClick={() => setAdminTab('users')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminTab === 'users'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          Quản lý Người dùng & RBAC ({userList.length})
        </button>

        <button
          onClick={() => setAdminTab('jobs')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminTab === 'jobs'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Việc làm ({jobs.length})
        </button>

        <button
          onClick={() => setAdminTab('gigs')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminTab === 'gigs'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Navigation className="w-4 h-4 text-amber-400" />
          Việc vặt Grab-style ({gigTasks.length})
        </button>

        <button
          onClick={() => setAdminTab('freelance')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminTab === 'freelance'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-400" />
          Dự án Freelance ({freelanceProjects.length})
        </button>
      </div>

      {/* SUBTAB 1: OVERVIEW */}
      {adminTab === 'overview' && (
        <>
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block">{stat.title}</span>
                    <span className="text-2xl font-black text-white">{stat.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reports and Content Moderation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Reports */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Báo cáo vi phạm từ người dùng ({reports.length})
              </h3>

              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">{rep.jobTitle}</p>
                      <p className="text-rose-400 mt-0.5">Lý do: {rep.reason}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Ngày báo: {rep.date}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {rep.status === 'PENDING' ? (
                        <button
                          onClick={() => handleResolveReport(rep.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Duyệt xử lý
                        </button>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Đã đóng
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Hashtags & Trends */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-400" />
                Phân bổ ngành nghề toàn hệ thống
              </h3>

              <div className="space-y-2.5 text-xs mb-4">
                {categoryBreakdown.length > 0 ? categoryBreakdown.map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-20 font-bold text-white flex-shrink-0 truncate">{cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-rose-500 to-indigo-500 transition-all duration-700"
                        style={{ width: `${Math.round((count / (jobs.length || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-rose-400 font-semibold w-8 text-right">{count}</span>
                  </div>
                )) : (
                  <p className="text-slate-500 text-center py-4">Chưa có dữ liệu</p>
                )}
              </div>

              {/* Application Status Breakdown */}
              <h4 className="text-xs font-bold text-slate-400 mb-2 mt-4 uppercase tracking-wider">Trạng thái hồ sơ</h4>
              <div className="grid grid-cols-2 gap-2">
                {statusBreakdown.map(s => (
                  <div key={s.label} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">{s.label}</span>
                    <span className={`font-black text-sm ${s.color}`}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

      {/* SUBTAB 2: USERS & RBAC MANAGEMENT */}
      {adminTab === 'users' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-400" />
                Quản lý Tài khoản & Phân quyền Vai trò
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Xem toàn bộ tài khoản đăng ký và điều chỉnh vai trò quyền hạn (job_seeker / employer / admin)
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm tên hoặc email..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="job_seeker">Ứng viên</option>
                <option value="employer">Nhà tuyển dụng</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>
          </div>

          {loadingUsers ? (
            <div className="text-center py-12 text-slate-400 text-xs">Đang tải danh sách người dùng...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/40">
                    <th className="p-3">Họ và tên</th>
                    <th className="p-3">Email đăng nhập</th>
                    <th className="p-3">Khu vực / SĐT</th>
                    <th className="p-3">Vai trò hiện tại</th>
                    <th className="p-3 text-right">Điều chỉnh quyền (RBAC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-semibold text-white flex items-center gap-2">
                        {u.role === 'admin' ? <ShieldCheck className="w-4 h-4 text-rose-400" /> :
                         u.role === 'employer' ? <Building2 className="w-4 h-4 text-purple-400" /> :
                         <User className="w-4 h-4 text-indigo-400" />}
                        <span>{u.name}</span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{u.email}</td>
                      <td className="p-3 text-slate-400">
                        {u.district || 'Hà Nội'} {u.phone ? `• ${u.phone}` : ''}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                          u.role === 'admin' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          u.role === 'employer' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                          'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {u.role === 'admin' ? 'Quản trị viên (Admin)' :
                           u.role === 'employer' ? 'Nhà tuyển dụng (Employer)' :
                           'Ứng viên (Job Seeker)'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                        >
                          <option value="job_seeker">Ứng viên</option>
                          <option value="employer">Nhà tuyển dụng</option>
                          <option value="admin">Quản trị viên</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ALL JOBS MODERATION */}
      {adminTab === 'jobs' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-rose-400" />
                Kiểm duyệt Việc làm Toàn sàn ({jobs.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Admin có thẩm quyền gỡ bỏ hoặc kiểm duyệt bất kỳ bài đăng nào có dấu hiệu vi phạm
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-xl flex-shrink-0">
                    {job.companyLogo || '💼'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {job.title}
                      {job.isHot && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">Hot</span>}
                      {job.isPinned && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">Ghim</span>}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Đăng bởi: <strong className="text-purple-400">{job.company}</strong> • {job.district}, {job.city} • Lương: <span className="text-indigo-300 font-semibold">{job.salaryDisplay}</span>
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span>Mã: {job.id}</span>
                      <span>Chủ sở hữu: {job.employerId || 'Hệ thống'}</span>
                      <span>Lượt xem: {job.views || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!job.isHot && (
                    <button
                      onClick={() => boostJob(job.id, 'hot')}
                      className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      title="Đẩy tin lên mục Việc Hot 🔥"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Đẩy Hot</span>
                    </button>
                  )}

                  {!job.isPinned && (
                    <button
                      onClick={() => boostJob(job.id, 'pin')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      title="Ghim tin đầu trang"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>Ghim</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleRemoveJob(job.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Gỡ bỏ bài đăng này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Gỡ bài vi phạm</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: GIG TASKS (VIỆC VẶT GRAB-STYLE) */}
      {adminTab === 'gigs' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-amber-400" />
                Kiểm duyệt Việc vặt Siêu tốc Grab-style ({gigTasks.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Giám sát các đơn vận chuyển, việc vặt ngắn hạn, đối soát người nhận đơn và an toàn hàng hóa
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Trạng thái:</span>
              <select
                value={gigStatusFilter}
                onChange={(e) => setGigStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Tất cả ({gigTasks.length})</option>
                <option value="AVAILABLE">Chờ tài xế ({gigTasks.filter(g => g.status === 'AVAILABLE').length})</option>
                <option value="ACCEPTED">Đang giao ({gigTasks.filter(g => g.status === 'ACCEPTED').length})</option>
                <option value="COMPLETED">Đã hoàn thành ({gigTasks.filter(g => g.status === 'COMPLETED').length})</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {gigTasks
              .filter(g => gigStatusFilter === 'ALL' || g.status === gigStatusFilter)
              .map((gig) => {
                const statusBadge = {
                  AVAILABLE: { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', label: '🟢 Chờ tài xế nhận' },
                  ACCEPTED: { bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: '🟡 Đang giao hàng' },
                  COMPLETED: { bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30', label: '🔵 Hoàn thành' }
                }[gig.status] || { bg: 'bg-slate-800 text-slate-300 border-slate-700', label: gig.status };

                return (
                  <div
                    key={gig.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-lg">🛵</span>
                        <h4 className="text-sm font-bold text-white">{gig.title}</h4>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${statusBadge.bg}`}>
                          {statusBadge.label}
                        </span>
                        {gig.cargoType && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            Loại hàng: {gig.cargoType}
                          </span>
                        )}
                        {gig.isValuable && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                            ⚠️ Hàng giá trị cao
                          </span>
                        )}
                      </div>

                      {/* Route */}
                      <div className="space-y-1 text-xs text-slate-300 my-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="text-slate-400">Lấy:</span>
                          <span className="font-semibold text-white">{gig.pickup?.address || 'Điểm lấy'}</span>
                          {gig.pickup?.contactName && <span className="text-slate-400 text-[11px]">({gig.pickup.contactName})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                          <span className="text-slate-400">Giao:</span>
                          <span className="font-semibold text-white">{gig.dropoff?.address || 'Điểm giao'}</span>
                          {gig.dropoff?.contactName && <span className="text-slate-400 text-[11px]">({gig.dropoff.contactName})</span>}
                          {gig.distanceKm && <span className="text-indigo-400 text-[11px] font-bold">({gig.distanceKm} km)</span>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>Mã đơn: <strong className="text-slate-300">{gig.id}</strong></span>
                        <span>Người tạo: <strong className="text-indigo-300">{gig.employer_id || 'Hệ thống'}</strong></span>
                        {gig.acceptedBy && (
                          <span>Tài xế nhận: <strong className="text-emerald-300">{gig.acceptedBy}</strong></span>
                        )}
                        <span>Thù lao: <strong className="text-emerald-400 text-xs">{gig.reward || `${gig.rewardNum?.toLocaleString()} đ`}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleRemoveGig(gig.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Gỡ bỏ việc vặt này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Gỡ việc vặt</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SUBTAB 5: FREELANCE PROJECTS */}
      {adminTab === 'freelance' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Kiểm duyệt Dự án Freelance Toàn sàn ({freelanceProjects.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Giám sát các dự án chào thầu, ngân sách, chào giá của Freelancer và can thiệp đóng/mở nhận thầu
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Trạng thái:</span>
              <select
                value={freelanceStatusFilter}
                onChange={(e) => setFreelanceStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">Tất cả ({freelanceProjects.length})</option>
                <option value="OPEN">Đang mở thầu ({freelanceProjects.filter(p => p.status === 'OPEN').length})</option>
                <option value="CLOSED">Đã đóng thầu ({freelanceProjects.filter(p => p.status === 'CLOSED').length})</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {freelanceProjects
              .filter(p => freelanceStatusFilter === 'ALL' || p.status === freelanceStatusFilter)
              .map((project) => (
                <div
                  key={project.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-lg">💼</span>
                      <h4 className="text-sm font-bold text-white">{project.title}</h4>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                          project.status === 'OPEN'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {project.status === 'OPEN' ? '🟢 Đang mở thầu' : '🔴 Đã đóng thầu'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                        {project.category || 'Freelance'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 my-1.5">
                      {project.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 my-1.5">
                      {(project.skills || []).map((sk, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {sk}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-2">
                      <span>Mã: <strong className="text-slate-300">{project.id}</strong></span>
                      <span>Chủ dự án: <strong className="text-indigo-300">{project.employer_name || project.employer_id || 'Chưa định danh'}</strong></span>
                      <span>Ngân sách: <strong className="text-purple-300 font-semibold">{project.budget}</strong></span>
                      <span>Hạn: <strong className="text-slate-300">{project.deadline}</strong></span>
                      <span>Đề xuất: <strong className="text-emerald-400 font-bold">{project.proposals_count || project.proposals?.length || 0} hồ sơ</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleToggleFreelanceStatus(project)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                      title="Chuyển đổi trạng thái đóng/mở nhận thầu"
                    >
                      {project.status === 'OPEN' ? 'Đóng thầu' : 'Mở lại'}
                    </button>
                    <button
                      onClick={() => handleRemoveFreelance(project.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Gỡ bỏ dự án này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Gỡ dự án</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiGetProjectProposals } from '../services/api';
import { 
  Compass, 
  Send, 
  Clock, 
  Users, 
  PlusCircle, 
  Briefcase,
  X,
  ShieldCheck,
  Eye,
  FileText
} from 'lucide-react';

export default function FreelancerModule() {
  const { 
    freelanceProjects, 
    createFreelanceProject, 
    submitProposal, 
    showToast,
    currentUser,
    isEmployer,
    isAdmin,
    setIsAuthModalOpen
  } = useApp();

  const [selectedProject, setSelectedProject] = useState(null);
  const [proposalBid, setProposalBid] = useState('');
  const [proposalDuration, setProposalDuration] = useState('');
  const [proposalCover, setProposalCover] = useState('');
  const [proposalPortfolio, setProposalPortfolio] = useState('');
  const [proposalExperience, setProposalExperience] = useState('');
  const [proposalStep, setProposalStep] = useState(1); // 1 = giá + thời hạn, 2 = thư ngỏ

  // View proposals modal state
  const [viewingProjectProposals, setViewingProjectProposals] = useState(null);
  const [proposalsList, setProposalsList] = useState([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [isProjectOwner, setIsProjectOwner] = useState(false);

  // Post project modal state
  const [isPostingProject, setIsPostingProject] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    budget: '',
    duration: '',
    category: 'Lập trình Web',
    skills: '',
    description: '',
    deadline: ''
  });

  const handleOpenProposal = (project) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập để gửi đề xuất nhận dự án!', 'info');
      return;
    }
    setSelectedProject(project);
    setProposalBid(project.budget);
    setProposalDuration(project.duration);
    setProposalCover('');
    setProposalPortfolio('');
    setProposalExperience('');
    setProposalStep(1);
  };

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    if (!proposalBid || !proposalCover) {
      showToast('Vui lòng điền đầy đủ mức giá và thư giới thiệu!', 'error');
      return;
    }

    const ok = await submitProposal(selectedProject.id, {
      bid: proposalBid,
      duration: proposalDuration,
      cover: `${proposalCover}${proposalPortfolio ? `\n\n📎 Portfolio/Dự án tham khảo:\n${proposalPortfolio}` : ''}${proposalExperience ? `\n\n📋 Kinh nghiệm liên quan:\n${proposalExperience}` : ''}`
    });

    if (ok) {
      setSelectedProject(null);
      setProposalStep(1);
    }
  };

  const handleOpenProposalsList = async (project) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập để xem thông tin đề xuất!', 'info');
      return;
    }

    setViewingProjectProposals(project);
    setIsLoadingProposals(true);
    try {
      const res = await apiGetProjectProposals(project.id);
      if (res.success) {
        setProposalsList(res.proposals || []);
        setIsProjectOwner(Boolean(res.isOwner));
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách đề xuất', 'error');
      setViewingProjectProposals(null);
    } finally {
      setIsLoadingProposals(false);
    }
  };

  const handleCreateProjectSubmit = async (e) => {
    e.preventDefault();
    if (!newProject.title || !newProject.budget) {
      showToast('Vui lòng điền tiêu đề và ngân sách dự án!', 'error');
      return;
    }

    const skillsArray = newProject.skills.split(',').map(s => s.trim()).filter(Boolean);
    const ok = await createFreelanceProject({
      ...newProject,
      skills: skillsArray
    });

    if (ok) {
      setIsPostingProject(false);
      setNewProject({
        title: '',
        budget: '',
        duration: '',
        category: 'Lập trình Web',
        skills: '',
        description: '',
        deadline: ''
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Hero Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-cyan-950/50 via-slate-900 to-indigo-950/60 border border-cyan-500/30 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold mb-2">
            <Compass className="w-3.5 h-3.5" />
            Module 2 • Sàn Dự Án Freelancer & Gói Khoán
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Nhận Dự Án Freelance & Chào Giá Trực Tiếp
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Khác với việc làm theo giờ, đây là nơi doanh nghiệp & cá nhân đăng dự án trọn gói. Freelancer tự do gửi Proposal bảo mật, thương lượng ngân sách và hạn chót bàn giao.
          </p>

          {(isEmployer || isAdmin) && (
            <div className="mt-4">
              <button
                onClick={() => setIsPostingProject(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-cyan-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Đăng dự án Freelance mới</span>
              </button>
            </div>
          )}
        </div>

        {/* Feature Comparison Mini-Card */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-xs space-y-1.5 min-w-[240px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex justify-between">
            <span>Tuyển dụng thường</span>
            <span className="text-cyan-400">Freelancer</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Lương tháng/giờ</span>
            <strong className="text-white">Giá trọn gói</strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Theo ca/giờ</span>
            <strong className="text-white">Theo Deadline</strong>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Nộp CV</span>
            <strong className="text-white">Gửi Proposal</strong>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {freelanceProjects.map((project) => {
          const isOwnerOfThis = currentUser && (
            currentUser.role === 'admin' || 
            (project.employerId && currentUser.id === project.employerId)
          );

          return (
            <div
              key={project.id}
              className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {project.category}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Hạn chót: {project.deadline}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors mb-2">
                  {project.title}
                </h3>

                <p className="text-xs text-slate-400 mb-1">
                  Bên thuê: <strong className="text-slate-200">{project.client}</strong>
                  {isOwnerOfThis && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                      Dự án của bạn
                    </span>
                  )}
                </p>

                {/* Budget & Duration Highlight */}
                <div className="my-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Ngân sách dự kiến</span>
                    <span className="text-base font-extrabold text-cyan-400">{project.budget}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Thời gian hoàn thành</span>
                    <span className="text-sm font-bold text-white">{project.duration}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-4">
                  {project.description}
                </p>

                {/* Skills Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {project.skills?.map((skill, idx) => (
                    <span key={idx} className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Proposal Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Users className="w-4 h-4 text-cyan-400" />
                  {project.proposalsCount} Freelancer chào giá
                </span>

                <div className="flex items-center gap-2">
                  {isOwnerOfThis ? (
                    <button
                      onClick={() => handleOpenProposalsList(project)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem {project.proposalsCount} đề xuất</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpenProposalsList(project)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                        title="Xem đề xuất bạn đã gửi"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Đơn của tôi</span>
                      </button>
                      <button
                        onClick={() => handleOpenProposal(project)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition-all active:scale-95 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi Proposal</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit Proposal Modal — 2-step form */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Gửi Báo Giá & Đề Xuất Dự Án
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Bước {proposalStep}/2
                  </span>
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-sm mt-0.5">{selectedProject.title}</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="px-6 pt-4 flex gap-2">
              {[1, 2].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= proposalStep ? 'bg-cyan-500' : 'bg-slate-800'
                }`} />
              ))}
            </div>

            <form onSubmit={handleSubmitProposal} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Project summary */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Ngân sách gốc:</span>
                  <span className="font-black text-cyan-400">{selectedProject.budget}</span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1">
                  <span className="text-slate-400">Thời hạn:</span>
                  <span className="font-semibold text-white">{selectedProject.duration}</span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1">
                  <span className="text-slate-400">Kỹ năng yêu cầu:</span>
                  <span className="text-slate-300">{selectedProject.skills?.join(', ')}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>Bảo mật thầu: Mức giá và thư ngỏ chỉ bên thuê dự án mới xem được.</span>
              </div>

              {/* Step 1: Price + Duration */}
              {proposalStep === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Mức giá đề xuất *</label>
                      <input
                        type="text"
                        required
                        value={proposalBid}
                        onChange={(e) => setProposalBid(e.target.value)}
                        placeholder="VD: 7.000.000đ"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Thời gian cam kết *</label>
                      <input
                        type="text"
                        required
                        value={proposalDuration}
                        onChange={(e) => setProposalDuration(e.target.value)}
                        placeholder="VD: 8 ngày"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Kinh nghiệm liên quan</label>
                    <textarea
                      rows={3}
                      value={proposalExperience}
                      onChange={(e) => setProposalExperience(e.target.value)}
                      placeholder="Mô tả ngắn kinh nghiệm của bạn với loại dự án này. VD: Đã làm 5 landing page tương tự cho các startup, quen với deadline gấp..."
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!proposalBid || !proposalDuration) {
                        showToast('Vui lòng điền mức giá và thời gian!', 'error');
                        return;
                      }
                      setProposalStep(2);
                    }}
                    className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    Tiếp theo: Viết Thư Ngỏ →
                  </button>
                </>
              )}

              {/* Step 2: Cover Letter + Portfolio */}
              {proposalStep === 2 && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Thư giới thiệu & Phương án triển khai *</label>
                    <textarea
                      rows={5}
                      required
                      value={proposalCover}
                      onChange={(e) => setProposalCover(e.target.value)}
                      placeholder={`Viết thư ngỏ thuyết phục:\n• Tại sao bạn phù hợp với dự án này?\n• Phương án kỹ thuật / sáng tạo bạn sẽ thực hiện?\n• Cam kết chất lượng và thời gian bàn giao?`}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">{proposalCover.length}/1000 ký tự (đề xuất 200-500 ký tự)</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Link Portfolio / Dự án tương tự
                      <span className="font-normal text-slate-500 ml-1">(tuỳ chọn nhưng tăng 60% tỷ lệ chọn)</span>
                    </label>
                    <input
                      type="text"
                      value={proposalPortfolio}
                      onChange={(e) => setProposalPortfolio(e.target.value)}
                      placeholder="VD: github.com/tenban/project, figma.com/..., portfolio.com"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setProposalStep(1)}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      ← Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={!proposalCover.trim()}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Xác nhận Gửi Proposal
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* View Proposals Modal */}
      {viewingProjectProposals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-400" />
                  {isProjectOwner ? 'Danh sách Báo giá từ Freelancer' : 'Đề xuất dự án của bạn'}
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">
                  {viewingProjectProposals.title}
                </p>
              </div>
              <button
                onClick={() => setViewingProjectProposals(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {!isProjectOwner && (
                <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Bảo mật cạnh tranh: Bạn chỉ xem được đề xuất do chính mình gửi. Giá thầu của freelancer khác được giữ kín tuyệt đối.</span>
                </div>
              )}

              {isLoadingProposals ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Đang tải danh sách đề xuất...
                </div>
              ) : proposalsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {isProjectOwner ? 'Chưa có freelancer nào gửi đề xuất cho dự án này.' : 'Bạn chưa gửi đề xuất nào cho dự án này.'}
                </div>
              ) : (
                proposalsList.map((prop) => (
                  <div key={prop.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">
                        {prop.applicant_name || 'Freelancer'}
                      </span>
                      <span className="text-xs font-black text-cyan-400">
                        {prop.bid}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Thời gian cam kết: <strong className="text-slate-200">{prop.duration}</strong></span>
                      <span>Ngày nộp: {new Date(prop.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {prop.cover}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post Project Modal (Employer / Admin) */}
      {isPostingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-cyan-400" />
                Đăng Dự Án Tuyển Freelancer Mới
              </h3>
              <button
                onClick={() => setIsPostingProject(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Tiêu đề dự án *</label>
                <input
                  type="text"
                  required
                  value={newProject.title}
                  onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="VD: Thiết kế Landing Page và Logo thương hiệu"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Ngân sách dự kiến *</label>
                  <input
                    type="text"
                    required
                    value={newProject.budget}
                    onChange={(e) => setNewProject(prev => ({ ...prev, budget: e.target.value }))}
                    placeholder="VD: 5.000.000đ - 8.000.000đ"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Thời hạn hoàn thành</label>
                  <input
                    type="text"
                    value={newProject.duration}
                    onChange={(e) => setNewProject(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="VD: 14 ngày"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Danh mục</label>
                  <select
                    value={newProject.category}
                    onChange={(e) => setNewProject(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="Lập trình Web">Lập trình Web</option>
                    <option value="Thiết kế">Thiết kế UI/UX & Đồ họa</option>
                    <option value="Content / Viết lách">Content / Viết lách</option>
                    <option value="Dịch thuật">Dịch thuật</option>
                    <option value="Video & Animation">Video & Animation</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Hạn nhận hồ sơ</label>
                  <input
                    type="date"
                    value={newProject.deadline}
                    onChange={(e) => setNewProject(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Kỹ năng yêu cầu (phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={newProject.skills}
                  onChange={(e) => setNewProject(prev => ({ ...prev, skills: e.target.value }))}
                  placeholder="Figma, React, UI/UX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Mô tả yêu cầu chi tiết dự án</label>
                <textarea
                  rows="3"
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả phạm vi công việc, sản phẩm cần bàn giao..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Đăng dự án lên Sàn Freelance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

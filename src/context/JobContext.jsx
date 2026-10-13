import React, { createContext, useContext, useState, useEffect } from 'react';
import { initialJobs } from '../data/initialJobs';
import { initialFreelance } from '../data/initialFreelance';
import { initialGigs } from '../data/initialGigs';
import { useAuth } from './AuthContext';
import {
  apiGetJobs,
  apiGetJob,
  apiCreateJob,
  apiUpdateJob,
  apiBoostJob,
  apiDeleteJob,
  apiSubmitApplication,
  apiWithdrawApplication,
  apiGetMyApplications,
  apiGetEmployerApplications,
  apiUpdateApplicationStatus,
  apiGetFreelance,
  apiCreateFreelanceProject,
  apiUpdateFreelanceProject,
  apiDeleteFreelanceProject,
  apiSubmitProposal,
  apiGetGigs,
  apiCreateGig,
  apiUpdateGig,
  apiDeleteGig,
  apiAcceptGig
} from '../services/api';

export const JobContext = createContext(null);

const DATA_VERSION = 'worklink_v4_sole_candidate_minhanh';

export function JobProvider({ children }) {
  const { 
    currentUser, 
    userProfile, 
    setIsAuthModalOpen, 
    showToast,
    canManageJob,
    canManageGig,
    canManageFreelance
  } = useAuth();

  // State: Data layers with auto-migration of old cached mock data
  const [jobs, setJobs] = useState(() => {
    try {
      const curVersion = localStorage.getItem('worklink_data_version');
      if (curVersion !== DATA_VERSION) {
        localStorage.setItem('worklink_data_version', DATA_VERSION);
        localStorage.removeItem('worklink_jobs');
        localStorage.removeItem('worklink_applications');
        return initialJobs;
      }
      const saved = localStorage.getItem('worklink_jobs');
      return saved ? JSON.parse(saved) : initialJobs;
    } catch {
      return initialJobs;
    }
  });

  const [freelanceProjects, setFreelanceProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('worklink_freelance');
      return saved ? JSON.parse(saved) : initialFreelance;
    } catch {
      return initialFreelance;
    }
  });

  const [gigTasks, setGigTasks] = useState(() => {
    try {
      const GIGS_VERSION = 'v4_landmark_perfect';
      const cachedVer = localStorage.getItem('worklink_gigs_ver');
      if (cachedVer !== GIGS_VERSION) {
        localStorage.setItem('worklink_gigs_ver', GIGS_VERSION);
        localStorage.setItem('worklink_gigs', JSON.stringify(initialGigs));
        return initialGigs;
      }
      const saved = localStorage.getItem('worklink_gigs');
      return saved ? JSON.parse(saved) : initialGigs;
    } catch {
      return initialGigs;
    }
  });

  // Saved jobs list - STRICTLY EMPTY if not logged in
  const [savedJobIds, setSavedJobIds] = useState(() => {
    try {
      const savedUser = localStorage.getItem('worklink_user');
      if (!savedUser) return [];
      const saved = localStorage.getItem('worklink_saved_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Applied applications - STRICTLY EMPTY if not logged in
  const [applications, setApplications] = useState(() => {
    try {
      const savedUser = localStorage.getItem('worklink_user');
      if (!savedUser) return [];
      const saved = localStorage.getItem('worklink_applications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // User interactions for recommendation engine
  const [userHistory, setUserHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('worklink_history');
      return saved ? JSON.parse(saved) : {
        viewedJobIds: ['job-1', 'job-2'],
        savedJobIds: ['job-1', 'job-2'],
        appliedJobIds: ['job-1', 'job-2'],
        clickedHashtags: ['#parttime', '#caugiay', '#it', '#phucvu']
      };
    } catch {
      return {
        viewedJobIds: ['job-1', 'job-2'],
        savedJobIds: ['job-1', 'job-2'],
        appliedJobIds: ['job-1', 'job-2'],
        clickedHashtags: ['#parttime', '#caugiay', '#it', '#phucvu']
      };
    }
  });

  // Navigation tab
  const [activeTab, setActiveTab] = useState('jobs');

  // Modal controls
  const [selectedJobForDetail, setSelectedJobForDetail] = useState(null);
  const [selectedJobForApply, setSelectedJobForApply] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [editingGig, setEditingGig] = useState(null);

  // Sync state to local storage
  useEffect(() => {
    try { localStorage.setItem('worklink_jobs', JSON.stringify(jobs)); } catch {}
  }, [jobs]);

  useEffect(() => {
    try { localStorage.setItem('worklink_saved_ids', JSON.stringify(savedJobIds)); } catch {}
  }, [savedJobIds]);

  useEffect(() => {
    try { localStorage.setItem('worklink_applications', JSON.stringify(applications)); } catch {}
  }, [applications]);

  useEffect(() => {
    try { localStorage.setItem('worklink_history', JSON.stringify(userHistory)); } catch {}
  }, [userHistory]);

  useEffect(() => {
    try { localStorage.setItem('worklink_freelance', JSON.stringify(freelanceProjects)); } catch {}
  }, [freelanceProjects]);

  useEffect(() => {
    try { localStorage.setItem('worklink_gigs', JSON.stringify(gigTasks)); } catch {}
  }, [gigTasks]);

  // Khi user logout (currentUser chuyển từ có sang null) -> dọn sạch dữ liệu cá nhân
  const prevUserRef = React.useRef(currentUser);
  useEffect(() => {
    if (prevUserRef.current && !currentUser) {
      setSavedJobIds([]);
      setApplications([]);
      setSelectedJobForApply(null);
    }
    prevUserRef.current = currentUser;
  }, [currentUser]);

  // Fetch initial data from Backend API on mount & on user change
  useEffect(() => {
    async function loadBackendData() {
      try {
        const jobsRes = await apiGetJobs();
        if (Array.isArray(jobsRes?.jobs)) {
          setJobs(jobsRes.jobs);
        }
      } catch {
        // Backend offline or starting up, using local state
      }

      try {
        const flRes = await apiGetFreelance();
        if (Array.isArray(flRes?.projects)) {
          setFreelanceProjects(flRes.projects);
        }
      } catch {}

      try {
        const gigRes = await apiGetGigs();
        if (Array.isArray(gigRes?.gigs)) {
          setGigTasks(gigRes.gigs);
        }
      } catch {}

      try {
        const isEmployerOrAdmin = currentUser?.role === 'employer' || currentUser?.role === 'admin';
        if (isEmployerOrAdmin && currentUser?.id) {
          const appRes = await apiGetEmployerApplications();
          if (Array.isArray(appRes?.applications)) {
            setApplications(appRes.applications);
          }
        } else if (currentUser?.role === 'job_seeker' && currentUser?.id) {
          const appRes = await apiGetMyApplications();
          if (Array.isArray(appRes?.applications)) {
            setApplications(appRes.applications);
          }
        }
      } catch {}
    }

    loadBackendData();
  }, [currentUser]);

  // Actions
  const toggleSaveJob = (jobId) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập để lưu công việc yêu thích!', 'info');
      return;
    }
    if (savedJobIds.includes(jobId)) {
      setSavedJobIds(prev => prev.filter(id => id !== jobId));
      showToast('Đã bỏ lưu công việc', 'info');
    } else {
      setSavedJobIds(prev => [...prev, jobId]);
      setUserHistory(prev => ({
        ...prev,
        savedJobIds: [...new Set([...prev.savedJobIds, jobId])]
      }));
      showToast('Đã lưu công việc vào danh sách quan tâm!');
    }
  };

  const recordJobView = async (jobId) => {
    if (!jobId) return;
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, views: (j.views || 0) + 1 } : j));
    setUserHistory(prev => ({
      ...prev,
      viewedJobIds: [...new Set([...prev.viewedJobIds, jobId])]
    }));

    try {
      const res = await apiGetJob(jobId);
      if (res?.job?.views !== undefined) {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, views: res.job.views } : j));
      }
    } catch {
      // Khi offline giữ giá trị cập nhật lạc quan
    }
  };

  const recordHashtagClick = (tag) => {
    setUserHistory(prev => ({
      ...prev,
      clickedHashtags: [...new Set([...prev.clickedHashtags, tag])]
    }));
  };

  const applyForJob = async (job, formData) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập tài khoản Ứng viên để nộp hồ sơ!', 'info');
      return;
    }

    try {
      const apiPayload = {
        jobId: job.id,
        applicantName: formData.name || currentUser.name || userProfile?.name,
        phone: formData.phone || currentUser.phone || userProfile?.phone,
        email: formData.email || currentUser.email || userProfile?.email,
        note: formData.note || '',
        cvName: formData.cvName || currentUser.cvName || userProfile?.cvName || 'CV_UngVien.pdf',
        cvFileId: formData.cvFileId || null
      };

      const res = await apiSubmitApplication(apiPayload);
      const serverApp = res.application;

      setApplications(prev => [serverApp, ...prev]);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, applicationsCount: (j.applicationsCount || 0) + 1 } : j));
      setUserHistory(prev => ({
        ...prev,
        appliedJobIds: [...new Set([...prev.appliedJobIds, job.id])]
      }));
      showToast(`Ứng tuyển thành công vị trí "${job.title}" tại ${job.company}!`);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi nộp hồ sơ';
      showToast(msg, 'error');
      throw e;
    }
  };

  const postNewJob = async (newJobData) => {
    if (!currentUser || (currentUser.role !== 'employer' && currentUser.role !== 'admin')) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập tài khoản Nhà tuyển dụng để đăng tin!', 'error');
      return;
    }

    try {
      const res = await apiCreateJob(newJobData);
      const serverJob = res.job;
      setJobs(prev => [serverJob, ...prev]);
      showToast('Đăng tin tuyển dụng thành công! Tin của bạn đã hiển thị trên WorkLink.');
      return serverJob;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi đăng tin';
      showToast(msg, 'error');
      throw e;
    }
  };

  const deleteJob = async (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!canManageJob(job)) {
      showToast('Bạn không có quyền xóa tin tuyển dụng này!', 'error');
      return false;
    }

    try {
      await apiDeleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      showToast('Đã xóa tin tuyển dụng thành công');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi xóa tin tuyển dụng';
      showToast(msg, 'error');
      return false;
    }
  };

  const updateJob = async (jobId, updatedData) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return false;

    if (!canManageJob(job)) {
      showToast('Bạn không có quyền chỉnh sửa tin tuyển dụng này!', 'error');
      return false;
    }

    try {
      const res = await apiUpdateJob(jobId, updatedData);
      const serverUpdated = res.job || { ...job, ...updatedData, id: jobId };
      setJobs(prev => prev.map(j => j.id === jobId ? serverUpdated : j));
      setSelectedJobForDetail(prev => prev && prev.id === jobId ? serverUpdated : prev);
      showToast('Đã cập nhật thông tin việc làm thành công!');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi cập nhật tin tuyển dụng';
      showToast(msg, 'error');
      return false;
    }
  };

  const withdrawApplication = async (appId) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return false;

    const isOwner = currentUser && (
      app.userId === currentUser.id ||
      app.email === currentUser.email ||
      currentUser.role === 'admin'
    );
    if (!isOwner) {
      showToast('Bạn không có quyền hủy hồ sơ này!', 'error');
      return false;
    }

    try {
      await apiWithdrawApplication(appId);
      setApplications(prev => prev.filter(a => a.id !== appId));

      if (app.jobId) {
        setJobs(prev => prev.map(j => 
          j.id === app.jobId 
            ? { ...j, applicationsCount: Math.max(0, (j.applicationsCount || 1) - 1) } 
            : j
        ));
        setUserHistory(prev => ({
          ...prev,
          appliedJobIds: (prev.appliedJobIds || []).filter(id => id !== app.jobId)
        }));
      }

      showToast('Đã hủy hồ sơ ứng tuyển thành công!');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi hủy hồ sơ';
      showToast(msg, 'error');
      return false;
    }
  };

  const boostJob = async (jobId, type) => {
    try {
      await apiBoostJob(jobId, type);
      setJobs(prev => prev.map(j => {
        if (j.id === jobId) {
          if (type === 'hot') return { ...j, isHot: true };
          if (type === 'pin') return { ...j, isPinned: true };
        }
        return j;
      }));
      showToast(type === 'pin' ? 'Đã ghim tin lên vị trí đầu trang (24h)!' : 'Đã đẩy tin gắn huy hiệu Tin Hot 🔥!');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi nâng cấp tin tuyển dụng';
      showToast(msg, 'error');
      return false;
    }
  };

  const updateApplicationStatus = async (appId, newStatus) => {
    try {
      await apiUpdateApplicationStatus(appId, newStatus);
      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, status: newStatus } : app
      ));

      showToast(`Đã cập nhật trạng thái ứng viên sang: ${
        newStatus === 'interview' ? 'Hẹn phỏng vấn' : 
        newStatus === 'reviewed' ? 'Đã xem hồ sơ' : 
        newStatus === 'rejected' ? 'Từ chối' : 'Chờ duyệt'
      }`);
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi cập nhật trạng thái hồ sơ';
      showToast(msg, 'error');
      return false;
    }
  };

  const createFreelanceProject = async (projectData) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập với tư cách Nhà tuyển dụng để đăng dự án!', 'info');
      return false;
    }
    if (currentUser.role !== 'employer' && currentUser.role !== 'admin') {
      showToast('Chỉ Nhà tuyển dụng hoặc Admin mới có quyền đăng dự án Freelance!', 'error');
      return false;
    }

    try {
      const res = await apiCreateFreelanceProject(projectData);
      if (res.success && res.project) {
        setFreelanceProjects(prev => [res.project, ...prev]);
        showToast('Đăng dự án Freelance thành công!');
        return true;
      }
      return false;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi đăng dự án';
      showToast(msg, 'error');
      return false;
    }
  };

  const submitProposal = async (projectId, proposalData) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập để gửi đề xuất nhận dự án!', 'info');
      return;
    }

    try {
      await apiSubmitProposal(projectId, proposalData);
      setFreelanceProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, proposalsCount: (p.proposalsCount || 0) + 1 } : p
      ));
      showToast(`Đã gửi báo giá / Proposal cho dự án thành công!`);
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi gửi báo giá';
      showToast(msg, 'error');
      return false;
    }
  };

  const updateFreelanceProject = async (projectId, updatedData) => {
    const project = freelanceProjects.find(p => p.id === projectId);
    if (!project) return false;

    if (!canManageFreelance(project)) {
      showToast('Bạn không có quyền chỉnh sửa dự án này!', 'error');
      return false;
    }

    try {
      const res = await apiUpdateFreelanceProject(projectId, updatedData);
      const serverUpdated = res.project || { ...project, ...updatedData, id: projectId };
      setFreelanceProjects(prev => prev.map(p => p.id === projectId ? serverUpdated : p));
      showToast('Đã cập nhật dự án Freelance thành công!');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi cập nhật dự án';
      showToast(msg, 'error');
      return false;
    }
  };

  const deleteFreelanceProject = async (projectId) => {
    const project = freelanceProjects.find(p => p.id === projectId);
    if (!project) return false;

    if (!canManageFreelance(project)) {
      showToast('Bạn không có quyền xóa dự án này!', 'error');
      return false;
    }

    try {
      await apiDeleteFreelanceProject(projectId);
      setFreelanceProjects(prev => prev.filter(p => p.id !== projectId));
      showToast('Đã xóa dự án Freelance thành công!');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi xóa dự án';
      showToast(msg, 'error');
      return false;
    }
  };

  const postNewGig = async (gigData) => {
    if (!currentUser || (currentUser.role !== 'employer' && currentUser.role !== 'admin')) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập tài khoản Nhà tuyển dụng để đăng việc vặt!', 'error');
      return false;
    }

    try {
      const res = await apiCreateGig(gigData);
      const serverGig = res.gig;
      setGigTasks(prev => [serverGig, ...prev]);
      showToast('Đăng cuốc việc vặt thành công! Đơn hàng đã hiển thị trên bản đồ.');
      return serverGig;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi đăng việc vặt';
      showToast(msg, 'error');
      throw e;
    }
  };

  const updateGig = async (gigId, updatedData) => {
    const gig = gigTasks.find(g => g.id === gigId);
    if (!gig) return false;

    if (!canManageGig(gig)) {
      showToast('Bạn không có quyền chỉnh sửa việc vặt này!', 'error');
      return false;
    }

    try {
      const res = await apiUpdateGig(gigId, updatedData);
      const serverUpdated = res.gig || { ...gig, ...updatedData, id: gigId };
      setGigTasks(prev => prev.map(g => g.id === gigId ? serverUpdated : g));
      showToast('Đã cập nhật cuốc việc vặt thành công!');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi cập nhật việc vặt';
      showToast(msg, 'error');
      return false;
    }
  };

  const deleteGig = async (gigId) => {
    const gig = gigTasks.find(g => g.id === gigId);
    if (!gig) return false;

    if (!canManageGig(gig)) {
      showToast('Bạn không có quyền xóa việc vặt này!', 'error');
      return false;
    }

    try {
      await apiDeleteGig(gigId);
      setGigTasks(prev => prev.filter(g => g.id !== gigId));
      showToast('Đã xóa cuốc việc vặt thành công!');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi khi xóa việc vặt';
      showToast(msg, 'error');
      return false;
    }
  };

  const acceptGig = async (gigId) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập tài khoản để nhận việc!', 'info');
      return;
    }

    const accepterName = currentUser.name || userProfile?.name || 'Ứng viên';
    try {
      const res = await apiAcceptGig(gigId, accepterName);
      setGigTasks(prev => prev.map(g => 
        g.id === gigId ? { 
          ...g, 
          status: 'ACCEPTED', 
          acceptedBy: res?.acceptedBy || currentUser.id, 
          acceptedByName: res?.acceptedByName || accepterName 
        } : g
      ));
      showToast('Bạn đã nhận cuốc việc vặt này! Vui lòng liên hệ người gửi hàng.');
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Lỗi nhận việc vặt';
      showToast(msg, 'error');
      return false;
    }
  };

  const handleSetSelectedJobForDetail = (job) => {
    setSelectedJobForDetail(job);
    if (job?.id) {
      recordJobView(job.id);
    }
  };

  const handleSetSelectedJobForApply = (job) => {
    if (!job) {
      setSelectedJobForApply(null);
      return;
    }
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập tài khoản Ứng viên để nộp hồ sơ!', 'info');
      return;
    }
    setSelectedJobForApply(job);
  };

  const resetDemoData = () => {
    localStorage.removeItem('worklink_jobs');
    localStorage.removeItem('worklink_freelance');
    localStorage.removeItem('worklink_gigs');
    localStorage.removeItem('worklink_saved_ids');
    localStorage.removeItem('worklink_applications');
    localStorage.removeItem('worklink_history');
    setJobs(initialJobs);
    setFreelanceProjects(initialFreelance);
    setGigTasks(initialGigs);
    setSavedJobIds([]);
    setApplications([]);
    showToast('Đã khôi phục dữ liệu việc làm mẫu của WorkLink!');
  };

  return (
    <JobContext.Provider
      value={{
        jobs,
        setJobs,
        freelanceProjects,
        setFreelanceProjects,
        gigTasks,
        setGigTasks,
        savedJobIds,
        setSavedJobIds,
        applications,
        setApplications,
        userHistory,
        setUserHistory,
        activeTab,
        setActiveTab,
        selectedJobForDetail,
        setSelectedJobForDetail: handleSetSelectedJobForDetail,
        selectedJobForApply,
        setSelectedJobForApply: handleSetSelectedJobForApply,
        editingJob,
        setEditingJob,
        editingGig,
        setEditingGig,
        toggleSaveJob,
        recordJobView,
        recordHashtagClick,
        applyForJob,
        postNewJob,
        deleteJob,
        updateJob,
        boostJob,
        withdrawApplication,
        updateApplicationStatus,
        createFreelanceProject,
        submitProposal,
        updateFreelanceProject,
        deleteFreelanceProject,
        postNewGig,
        updateGig,
        deleteGig,
        acceptGig,
        resetDemoData
      }}
    >
      {children}
    </JobContext.Provider>
  );
}

export function useJob() {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
}

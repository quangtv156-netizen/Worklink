import React, { useState, useMemo, useCallback, Suspense, lazy } from "react";
import { useApp } from "../context/AppContext";
import AISearchHero from "../components/AISearchHero";
import FilterBar from "../components/FilterBar";
import JobCard from "../components/JobCard";
import JobCardSkeleton from "../components/JobCardSkeleton";
import RecommendationList from "../components/RecommendationList";
import HotFeedSection from "../components/HotFeedSection";
import JobSeekerProfile from "../components/JobSeekerProfile";
import { filterAndRankJobs } from "../services/aiSearchService";
import { apiAISearch } from "../services/api";
import { soundFx } from "../services/soundEffects";
import {
  Sparkles,
  Briefcase,
  Flame,
  Compass,
  MapPin,
  User,
  Volume2,
  VolumeX,
  Building2,
  ShieldCheck,
  Search,
  ArrowRight,
  ArrowUp,
  LogIn,
  LogOut,
  Globe,
} from "lucide-react";
import { scrollToTop } from "../services/scrollService";

import NotificationBell from "../components/NotificationBell";

const FreelancerModule = lazy(() => import("../components/FreelancerModule"));
const GigMapModule = lazy(() => import("../components/GigMapModule"));
const ExternalJobsPanel = lazy(() => import("../components/ExternalJobsPanel"));

export default function JobSeekerLayout({ onSwitchPortal }) {
  const { jobs, currentUser, logout, setIsAuthModalOpen, setIsCVAnalyzerOpen } =
    useApp();

  const [activeTab, setActiveTab] = useState("jobs"); // 'jobs' | 'hot_feed' | 'freelance' | 'gigs' | 'profile'
  const [isSoundMuted, setIsSoundMuted] = useState(() => soundFx.getMuted());
  const [showBackToTop, setShowBackToTop] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 380);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Search and Filter States
  const [naturalQuery, setNaturalQuery] = useState("");
  const [filters, setFilters] = useState({
    keyword: "",
    hashtag: "",
    category: "",
    location: "",
    job_type: "",
    time: "",
    experience: "",
    min_salary_hourly: null,
  });
  const [isSearching, setIsSearching] = useState(false);

  // Local AI ranking
  const localRanked = useMemo(() => {
    return filterAndRankJobs(jobs, naturalQuery, filters);
  }, [jobs, naturalQuery, filters]);

  const [backendRanked, setBackendRanked] = useState(null);
  const { extractedCriteria, rankedJobs } = backendRanked || localRanked;

  const handlePerformSearch = useCallback(
    async (query) => {
      setIsSearching(true);
      setNaturalQuery(query);
      setBackendRanked(null);

      try {
        const data = await apiAISearch(query, filters);
        const jobsList = data?.rankedJobs || data?.jobs;
        if (data?.success && Array.isArray(jobsList)) {
          setBackendRanked({
            extractedCriteria: data.extractedCriteria || {},
            rankedJobs: jobsList,
          });
        }
      } catch {
        // local fallback
      } finally {
        setIsSearching(false);
      }
    },
    [filters],
  );

  const handleResetFilters = () => {
    setNaturalQuery("");
    setBackendRanked(null);
    setFilters({
      keyword: "",
      hashtag: "",
      category: "",
      location: "",
      job_type: "",
      time: "",
      experience: "",
      min_salary_hourly: null,
    });
  };

  const handleToggleSound = () => {
    const newState = soundFx.toggleMute();
    setIsSoundMuted(newState);
    if (!newState) soundFx.playPop();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Admin or Employer preview banner */}
      {currentUser?.role === "admin" && (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-b border-rose-500/30 px-4 py-2 text-xs flex items-center justify-between text-rose-300">
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span>
              Chế độ Quản trị viên: Đang xem trước Cổng Ứng viên (Candidate
              Portal)
            </span>
          </div>
          <button
            onClick={() => onSwitchPortal("admin")}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Quay lại Admin Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {currentUser?.role === "employer" && (
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-purple-950 border-b border-purple-500/30 px-4 py-2 text-xs flex items-center justify-between text-purple-300">
          <div className="flex items-center gap-2 font-bold">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span>
              Chế độ Nhà Tuyển Dụng: Đang xem trước Cổng Ứng viên (Candidate
              View)
            </span>
          </div>
          <button
            onClick={() => onSwitchPortal("employer")}
            className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Quay lại Recruiter Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Seeker Header Navbar */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 min-w-0 w-full">
          {/* Logo */}
          <div
            onClick={() => {
              if (activeTab === "jobs") {
                scrollToTop();
              } else {
                setActiveTab("jobs");
              }
            }}
            className="flex items-center gap-2 cursor-pointer group shrink-0 min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight font-heading text-white">
                  Work<span className="text-indigo-400">Link</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Ứng viên
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden xl:block">
                Tìm kiếm việc làm & sinh viên thông minh
              </p>
            </div>
          </div>

          {/* Navigation for Candidates */}
          <nav className="hidden lg:flex items-center flex-nowrap gap-0.5 xl:gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800 shrink min-w-0 overflow-hidden">
            <button
              onClick={() => {
                if (activeTab === "jobs") {
                  scrollToTop();
                } else {
                  setActiveTab("jobs");
                }
              }}
              className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === "jobs"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Tìm việc
            </button>

            <button
              onClick={() => setActiveTab("hot_feed")}
              className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === "hot_feed"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Việc Hot 🔥
            </button>

            <button
              onClick={() => setActiveTab("freelance")}
              className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === "freelance"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Freelance
            </button>

            <button
              onClick={() => setActiveTab("gigs")}
              className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === "gigs"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Việc vặt Gig
            </button>

            <button
              onClick={() => setActiveTab("external")}
              className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === "external"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              Việc TopCV 🟢
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === "profile"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Hồ sơ của tôi
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap ml-auto">
            {/* AI CV Scanner */}
            <button
              onClick={() => {
                soundFx.playPop();
                setIsCVAnalyzerOpen(true);
              }}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/40 hover:border-indigo-400 text-indigo-300 hover:text-white text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer shadow-sm"
              title="AI Quét CV & Đề xuất việc làm phù hợp"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">AI Quét CV</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              className="hidden sm:flex p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              title={isSoundMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isSoundMuted ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {/* Notification button */}
            <NotificationBell onNavigateTab={setActiveTab} />

            {/* Switch to Employer Portal Link */}
            {(!currentUser ||
              currentUser.role === "employer" ||
              currentUser.role === "admin") && (
              <button
                onClick={() => {
                  if (
                    currentUser?.role === "employer" ||
                    currentUser?.role === "admin"
                  ) {
                    onSwitchPortal("employer");
                  } else {
                    setIsAuthModalOpen(true);
                  }
                }}
                className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
                title="Chuyển sang Cổng Tuyển dụng"
              >
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Kênh Tuyển Dụng</span>
              </button>
            )}

            {/* Auth / Account */}
            {currentUser ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab("profile")}
                  className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs font-bold text-white whitespace-nowrap"
                  title={currentUser.name}
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[11px] shrink-0">
                    {currentUser.name
                      ? currentUser.name.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  <span className="hidden xl:inline max-w-[90px] truncate">
                    {currentUser.name}
                  </span>
                </button>

                <button
                  onClick={logout}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Submenu */}
        <div className="lg:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-2 bg-slate-950/90 text-xs font-semibold text-slate-400">
          <button
            onClick={() => setActiveTab("jobs")}
            className={activeTab === "jobs" ? "text-indigo-400 font-bold" : ""}
          >
            Tìm việc
          </button>
          <button
            onClick={() => setActiveTab("hot_feed")}
            className={
              activeTab === "hot_feed" ? "text-orange-400 font-bold" : ""
            }
          >
            Việc Hot
          </button>
          <button
            onClick={() => setActiveTab("freelance")}
            className={
              activeTab === "freelance" ? "text-cyan-400 font-bold" : ""
            }
          >
            Freelance
          </button>
          <button
            onClick={() => setActiveTab("gigs")}
            className={activeTab === "gigs" ? "text-emerald-400 font-bold" : ""}
          >
            Việc vặt
          </button>
          <button
            onClick={() => setActiveTab("external")}
            className={
              activeTab === "external" ? "text-emerald-400 font-bold" : ""
            }
          >
            🌐 Sàn
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={
              activeTab === "profile" ? "text-indigo-400 font-bold" : ""
            }
          >
            Hồ sơ
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === "jobs" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <AISearchHero
              naturalQuery={naturalQuery}
              setNaturalQuery={setNaturalQuery}
              onPerformSearch={handlePerformSearch}
              extractedCriteria={extractedCriteria}
              isSearching={isSearching}
            />

            <RecommendationList />

            <FilterBar
              filters={filters}
              setFilters={setFilters}
              onResetFilters={handleResetFilters}
            />

            <div
              id="job-results-section"
              className="flex items-center justify-between mb-6 scroll-mt-24"
            >
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>Khám phá việc làm</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {rankedJobs.length} công việc
                  </span>
                </h2>
                {naturalQuery && (
                  <p className="text-xs text-indigo-300 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Đang xếp hạng theo mức độ phù hợp với yêu cầu của bạn
                  </p>
                )}
              </div>
            </div>

            {isSearching ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : rankedJobs.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">
                  Không tìm thấy công việc phù hợp
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Thử tìm kiếm với câu hỏi tổng quát hơn hoặc đặt lại các bộ lọc
                  để xem toàn bộ danh sách việc làm.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Đặt lại tất cả bộ lọc
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rankedJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs font-medium">Đang tải phân hệ...</span>
            </div>
          }
        >
          {activeTab === "hot_feed" && <HotFeedSection />}
          {activeTab === "freelance" && <FreelancerModule />}
          {activeTab === "gigs" && <GigMapModule />}
          {activeTab === "external" && <ExternalJobsPanel />}
          {activeTab === "profile" && <JobSeekerProfile />}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/80 py-8 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-white">WorkLink 2026</span>
            <span>— Cổng kết nối việc làm và cơ hội sinh viên</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <button
              onClick={() => onSwitchPortal("employer")}
              className="hover:text-purple-400 transition-colors cursor-pointer"
            >
              Dành cho Doanh nghiệp & Tuyển dụng ➔
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={() => {
            soundFx.playPop();
            scrollToTop();
          }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/95 hover:bg-indigo-600 border border-indigo-500/40 hover:border-indigo-400 text-slate-200 hover:text-white shadow-2xl backdrop-blur-md text-xs font-bold transition-all duration-300 transform hover:-translate-y-1 active:scale-95 cursor-pointer animate-fadeIn group"
          title="Cuộn mượt lên đầu trang"
        >
          <ArrowUp className="w-4 h-4 text-indigo-400 group-hover:text-white group-hover:-translate-y-0.5 transition-transform" />
          <span className="font-semibold">Lên đầu trang</span>
        </button>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Package, 
  Navigation, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  CheckCircle2,
  X,
  Printer,
  ExternalLink,
  PhoneCall
} from 'lucide-react';

const TILE_PROVIDERS = {
  street: {
    name: 'Bản đồ Chuẩn',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    options: {
      subdomains: 'abc',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors, Humanitarian OSM'
    }
  },
  dark: {
    name: 'Bản đồ Tối',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 18,
      attribution: '&copy; Esri Dark Canvas'
    }
  },
  satellite: {
    name: 'Vệ tinh',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution: '&copy; Esri World Imagery'
    }
  }
};

// Helper chuẩn hóa thông tin liên lạc GrabExpress (Người gửi / Người nhận)
function parseContact(gig, type = 'sender') {
  if (!gig) return { name: '', phone: '' };
  if (type === 'sender') {
    const name = gig.senderName || (gig.sender ? gig.sender.replace(/\(.*?\)/g, '').trim() : 'Nguyễn Văn Minh');
    const phoneMatch = gig.sender ? gig.sender.match(/(\d{3,4}[\s*.-]?\d{3}[\s*.-]?\d{3,4})/) : null;
    const phone = gig.senderPhone || (phoneMatch ? phoneMatch[0].replace(/\*/g, '8') : '0982 345 123');
    return { name, phone };
  } else {
    const name = gig.receiverName || (gig.receiver ? gig.receiver.replace(/\(.*?\)/g, '').trim() : 'Lê Thu Hà');
    const phoneMatch = gig.receiver ? gig.receiver.match(/(\d{3,4}[\s*.-]?\d{3}[\s*.-]?\d{3,4})/) : null;
    const phone = gig.receiverPhone || (phoneMatch ? phoneMatch[0].replace(/\*/g, '8') : '0974 567 456');
    return { name, phone };
  }
}

// Helper chuẩn hóa từ khóa tìm kiếm địa chỉ cho Google Maps
// Tránh việc truyền tọa độ số khiến Google Maps tự động snap sang phòng khám hay tổ dân phố lân cận
function getLocationSearchText(loc) {
  if (!loc) return '';
  const text = (loc.address || loc.name || '').trim();
  if (text.toLowerCase().includes('hà nội')) {
    return text;
  }
  return `${text}, Hà Nội`;
}

export default function GigMapModule() {
  const { gigTasks, acceptGig, userProfile, currentUser, showToast } = useApp();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [selectedGig, setSelectedGig] = useState(gigTasks[0] || null);
  const [activeMapStyle, setActiveMapStyle] = useState('street'); // 'street' | 'dark' | 'satellite'
  const [showContractModal, setShowContractModal] = useState(false);

  // 1. Khởi tạo bản đồ duy nhất 1 lần khi Mount (tránh hủy / tạo lại liên tục)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Sửa đường dẫn icon mặc định của Leaflet
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [21.0285, 105.8150], // Tọa độ trung tâm Hà Nội
        zoom: 13,
        scrollWheelZoom: false,
        zoomControl: true
      });

      // Thêm tile layer mặc định (OpenStreetMap HOT - sắc nét, không cần API key, không watermark)
      const initialProvider = TILE_PROVIDERS.street;
      const tileLayer = L.tileLayer(initialProvider.url, initialProvider.options).addTo(map);
      tileLayerRef.current = tileLayer;

      // Nhóm layer chứa marker và route
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      mapInstanceRef.current = map;

      // Gọi invalidateSize nhiều lần sau các khung thời gian ngắn để chống xám bản đồ
      const t1 = setTimeout(() => map.invalidateSize(), 100);
      const t2 = setTimeout(() => map.invalidateSize(), 300);
      const t3 = setTimeout(() => map.invalidateSize(), 800);

      // Theo dõi thay đổi kích thước container tự động
      let resizeObserver = null;
      if (window.ResizeObserver && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        if (resizeObserver) resizeObserver.disconnect();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  // 2. Chuyển đổi giao diện bản đồ (Chuẩn / Tối / Vệ tinh)
  const handleSwitchMapStyle = useCallback((styleKey) => {
    setActiveMapStyle(styleKey);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const provider = TILE_PROVIDERS[styleKey] || TILE_PROVIDERS.street;
    const newTileLayer = L.tileLayer(provider.url, provider.options).addTo(map);
    tileLayerRef.current = newTileLayer;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, []);

  // 3. Cập nhật Marker và Tuyến đường khi chọn đơn khác (Không làm đơ/reset bản đồ)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer || !selectedGig) return;

    // Xóa marker & đường cũ
    markersLayer.clearLayers();

    const p = selectedGig.pickupLocation;
    const d = selectedGig.dropoffLocation;

    if (!p || !d || !p.lat || !d.lat) return;

    // Custom Icon sắc nét, căn giữa chuẩn
    const pickupIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background: linear-gradient(135deg, #6366f1, #4338ca); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2.5px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.5); cursor: pointer;">📦</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });

    const dropoffIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background: linear-gradient(135deg, #10b981, #047857); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2.5px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.5); cursor: pointer;">📍</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });

    const pickupSearch = getLocationSearchText(p);
    const dropoffSearch = getLocationSearchText(d);

    const googlePickupUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupSearch)}`;
    const googleDropoffUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoffSearch)}`;
    const googleRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickupSearch)}&destination=${encodeURIComponent(dropoffSearch)}&travelmode=motorcycle`;

    L.marker([p.lat, p.lng], { icon: pickupIcon }).addTo(markersLayer)
      .bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #0f172a; padding: 4px; min-width: 170px;">
          <b style="color: #4338ca; font-size: 13px;">📦 Điểm lấy hàng:</b><br/>
          <span style="font-weight: 600; color: #334155;">${p.name}</span>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <a href="${googlePickupUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: bold; text-decoration: none; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
              📍 Mở trên Google Maps ↗
            </a>
          </div>
        </div>
      `);

    L.marker([d.lat, d.lng], { icon: dropoffIcon }).addTo(markersLayer)
      .bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #0f172a; padding: 4px; min-width: 170px;">
          <b style="color: #047857; font-size: 13px;">📍 Điểm giao hàng:</b><br/>
          <span style="font-weight: 600; color: #334155;">${d.name}</span>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px;">
            <a href="${googleDropoffUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: bold; text-decoration: none; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
              📍 Mở vị trí trên Google Maps ↗
            </a>
            <a href="${googleRouteUrl}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-weight: bold; text-decoration: none; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
              🚀 Dẫn đường xe máy trên GG Maps ↗
            </a>
          </div>
        </div>
      `);

    // Đường lộ trình kết nối có hiệu ứng nét đứt
    L.polyline([[p.lat, p.lng], [d.lat, d.lng]], {
      color: '#6366f1',
      weight: 4,
      opacity: 0.9,
      dashArray: '8, 8',
      lineCap: 'round'
    }).addTo(markersLayer);

    // Tự động thu phóng vừa vặn lộ trình
    map.fitBounds([[p.lat, p.lng], [d.lat, d.lng]], { 
      padding: [60, 60],
      maxZoom: 15,
      animate: true
    });

    // Invalidate size lại lần nữa khi chuyển gig
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedGig]);

  // Helper tạo link điều hướng Google Maps chính xác theo tên và địa chỉ thực tế
  const getGoogleMapsDirectionsUrl = (gig) => {
    if (!gig?.pickupLocation || !gig?.dropoffLocation) return '#';
    const origin = getLocationSearchText(gig.pickupLocation);
    const destination = getLocationSearchText(gig.dropoffLocation);
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=motorcycle`;
  };

  const handleSelectGig = (gig) => {
    setSelectedGig(gig);
  };

  const handleAcceptClick = async (gig) => {
    if (currentUser?.role !== 'job_seeker') {
      showToast('Chỉ tài khoản Ứng viên mới nhận được cuốc này', 'warning');
      return;
    }
    if (gig.requiresContract) {
      setSelectedGig(gig);
      setShowContractModal(true);
    } else {
      await acceptGig(gig.id);
    }
  };

  const handleSignElectronicContract = async () => {
    if (currentUser?.role !== 'job_seeker') {
      showToast('Chỉ tài khoản Ứng viên mới nhận được cuốc này', 'warning');
      return;
    }
    if (!selectedGig) return;
    const ok = await acceptGig(selectedGig.id);
    if (ok) {
      setShowContractModal(false);
      setSelectedGig(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-indigo-950/60 border border-emerald-500/30 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-2">
            <MapPin className="w-3.5 h-3.5" />
            Module 3 • Việc Vặt & Giao Hàng Xung Quanh (Bản đồ Leaflet)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Việc Vặt Tức Thì & Bản Đồ Định Vị
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Tận dụng thời gian rảnh nhận các việc vặt, giao tài liệu, hỗ trợ chuyển trọ xung quanh bạn. Tích hợp phân loại an toàn hàng hóa và biên bản giao nhận điện tử.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-white">Xác minh an toàn</p>
            <p className="text-[11px] text-slate-400">Bảo hiểm & Biên bản điện tử</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left List + Right Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Gigs List */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Danh sách việc vặt đang cần ({gigTasks.length})</span>
            <span className="text-emerald-400 font-bold text-xs">Hà Nội</span>
          </h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {gigTasks.map((gig) => {
              const isSelected = selectedGig?.id === gig.id;
              const sender = parseContact(gig, 'sender');
              const receiver = parseContact(gig, 'receiver');
              return (
                <div
                  key={gig.id}
                  onClick={() => handleSelectGig(gig)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top bar: Mã vận đơn Grab + Thể loại + Cước phí */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 border border-emerald-500/30">
                        #{gig.bookingCode || 'GRAB-EXP-' + gig.id.slice(-4)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        gig.isValuable
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}>
                        {gig.cargoType}
                      </span>
                    </div>

                    <span className="text-base font-extrabold text-emerald-400">
                      {gig.reward}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-2 line-clamp-1">
                    {gig.title}
                  </h4>

                  {/* Thông số kiện hàng Grab */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      <Package className="w-3 h-3 text-amber-400" />
                      {gig.packageWeight || 'Kiện tiêu chuẩn'}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                      💳 {gig.paymentMethod || 'Tiền mặt'}
                    </span>
                  </div>

                  {/* Chi tiết người gửi & người nhận */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs text-slate-300 mb-3">
                    {/* Điểm lấy */}
                    <div>
                      <div className="flex items-start gap-1.5 text-slate-200">
                        <span className="text-indigo-400 font-bold shrink-0">📦 Lấy:</span>
                        <span className="font-semibold line-clamp-1">{gig.pickupLocation.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pl-5 mt-0.5">
                        <span>Gửi: <strong className="text-slate-200">{sender.name}</strong></span>
                        <a 
                          href={`tel:${sender.phone.replace(/\s+/g, '')}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
                          title="Gọi điện người gửi"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>{sender.phone}</span>
                        </a>
                      </div>
                    </div>

                    {/* Điểm giao */}
                    <div className="pt-1.5 border-t border-slate-800/60">
                      <div className="flex items-start gap-1.5 text-slate-200">
                        <span className="text-emerald-400 font-bold shrink-0">📍 Giao:</span>
                        <span className="font-semibold line-clamp-1">{gig.dropoffLocation.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pl-5 mt-0.5">
                        <span>Nhận: <strong className="text-slate-200">{receiver.name}</strong></span>
                        <a 
                          href={`tel:${receiver.phone.replace(/\s+/g, '')}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
                          title="Gọi điện người nhận"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>{receiver.phone}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {gig.note && (
                    <p className="text-[11px] text-slate-400 italic line-clamp-1 mb-2.5">
                      💬 "{gig.note}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                    <span>Khoảng cách: <strong className="text-white">~{gig.distanceKm} km</strong></span>
                    <span>Thời gian: <strong className="text-white">{gig.time}</strong></span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    {gig.requiresContract && (
                      <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Cần ký biên bản
                      </span>
                    )}

                    {gig.status === 'ACCEPTED' ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Đã nhận việc
                      </span>
                    ) : currentUser?.role === 'job_seeker' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptClick(gig);
                        }}
                        className="ml-auto px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
                      >
                        Nhận đơn
                      </button>
                    ) : (
                      <span className="ml-auto text-[11px] text-amber-400/90 italic font-medium text-right">
                        Chỉ tài khoản Ứng viên mới nhận được cuốc này
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Interactive Leaflet Map */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex-1 flex flex-col min-h-[500px]">
            
            {/* Map Top Info & Theme Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <Navigation className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Lộ trình vận chuyển trên bản đồ</span>
                {selectedGig && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30">
                    Cự ly ~{selectedGig.distanceKm} km
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Direct Google Maps Navigation Button */}
                {selectedGig && (
                  <a
                    href={getGoogleMapsDirectionsUrl(selectedGig)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer active:scale-95 border border-blue-400/40"
                    title="Mở chỉ đường Google Maps trong tab mới để xem điều hướng trực tiếp"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở trên Google Maps ↗</span>
                  </a>
                )}

                {/* Map Layer Switcher */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSwitchMapStyle('street')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeMapStyle === 'street'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Bản đồ đường phố chi tiết OpenStreetMap"
                  >
                    🏙️ Chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMapStyle('dark')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeMapStyle === 'dark'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Giao diện bản đồ nền tối huyền bí"
                  >
                    🌙 Tối
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMapStyle('satellite')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeMapStyle === 'satellite'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Ảnh vệ tinh mặt đất Esri"
                  >
                    🛰️ Vệ tinh
                  </button>
                </div>
              </div>
            </div>

            {/* Map Container Element */}
            <div className="relative flex-1 w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 min-h-[460px] shadow-inner">
              <div 
                ref={mapContainerRef} 
                className="w-full h-full min-h-[460px]" 
                style={{ width: '100%', height: '100%', minHeight: '460px' }} 
              />
            </div>

            {/* Selected Gig Detail Legend */}
            {selectedGig && (() => {
              const selSender = parseContact(selectedGig, 'sender');
              const selReceiver = parseContact(selectedGig, 'receiver');
              return (
                <div className="mt-3 p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        #{selectedGig.bookingCode || 'GRAB-EXP-TRIP'}
                      </span>
                      <span className="font-bold text-white text-sm">{selectedGig.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-emerald-400">{selectedGig.reward}</span>
                      <span className="text-[11px] text-slate-400">({selectedGig.paymentMethod || 'Tiền mặt'})</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                      <p className="text-[11px] text-indigo-300 font-bold mb-1">📦 ĐIỂM LẤY HÀNG (NGƯỜI GỬI):</p>
                      <p className="font-semibold text-white">{selectedGig.pickupLocation.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{selectedGig.pickupLocation.address}</p>
                      <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                        <span className="text-slate-300">Người gửi: <strong className="text-white">{selSender.name}</strong></span>
                        <a 
                          href={`tel:${selSender.phone.replace(/\s+/g, '')}`} 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>{selSender.phone}</span>
                        </a>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                      <p className="text-[11px] text-emerald-300 font-bold mb-1">📍 ĐIỂM GIAO HÀNG (NGƯỜI NHẬN):</p>
                      <p className="font-semibold text-white">{selectedGig.dropoffLocation.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{selectedGig.dropoffLocation.address}</p>
                      <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                        <span className="text-slate-300">Người nhận: <strong className="text-white">{selReceiver.name}</strong></span>
                        <a 
                          href={`tel:${selReceiver.phone.replace(/\s+/g, '')}`} 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>{selReceiver.phone}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400">
                      <span>Loại hàng: <strong className="text-slate-200">{selectedGig.cargoType}</strong></span>
                      <span className="mx-2">•</span>
                      <span>Trọng lượng: <strong className="text-slate-200">{selectedGig.packageWeight || 'Tiêu chuẩn'}</strong></span>
                      {selectedGig.note && (
                        <p className="text-slate-400 italic mt-0.5">Ghi chú: {selectedGig.note}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {selectedGig.status !== 'ACCEPTED' && (
                        currentUser?.role === 'job_seeker' ? (
                          <button
                            onClick={() => handleAcceptClick(selectedGig)}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-600/30"
                          >
                            Nhận đơn GrabExpress
                          </button>
                        ) : (
                          <span className="text-xs text-amber-400/90 italic font-medium">
                            Chỉ tài khoản Ứng viên mới nhận được cuốc này
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>

      </div>

      {/* Electronic Delivery Contract Modal (Section 14) */}
      {showContractModal && selectedGig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2 text-amber-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Biên Bản Giao Nhận Điện Tử</h3>
              </div>
              <button
                onClick={() => setShowContractModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Đơn hàng thuộc loại <strong>{selectedGig.cargoType}</strong>. Hệ thống yêu cầu xác nhận biên bản điện tử trước khi nhận đơn để bảo đảm quyền lợi cho cả 2 bên.
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Mã đơn: <strong className="text-emerald-400 font-mono">#{selectedGig.bookingCode || 'GRAB-EXP-8891'}</strong></span>
                  <span className="text-slate-400">Hình thức: <strong className="text-slate-200">{selectedGig.paymentMethod || 'Tiền mặt'}</strong></span>
                </div>
                <p><strong>Loại hàng hóa:</strong> {selectedGig.cargoType} ({selectedGig.packageWeight || 'Kiện tiêu chuẩn'})</p>
                <div className="flex items-center justify-between bg-slate-900 p-2 rounded-xl">
                  <span><strong>Người gửi:</strong> {parseContact(selectedGig, 'sender').name}</span>
                  <a href={`tel:${parseContact(selectedGig, 'sender').phone.replace(/\s+/g, '')}`} className="text-emerald-400 font-bold inline-flex items-center gap-1">
                    <PhoneCall className="w-3 h-3" /> {parseContact(selectedGig, 'sender').phone}
                  </a>
                </div>
                <p className="text-slate-400 pl-2 text-[11px]">📍 Lấy tại: {selectedGig.pickupLocation.address || selectedGig.pickupLocation.name}</p>
                
                <div className="flex items-center justify-between bg-slate-900 p-2 rounded-xl">
                  <span><strong>Người nhận:</strong> {parseContact(selectedGig, 'receiver').name}</span>
                  <a href={`tel:${parseContact(selectedGig, 'receiver').phone.replace(/\s+/g, '')}`} className="text-emerald-400 font-bold inline-flex items-center gap-1">
                    <PhoneCall className="w-3 h-3" /> {parseContact(selectedGig, 'receiver').phone}
                  </a>
                </div>
                <p className="text-slate-400 pl-2 text-[11px]">📍 Giao tại: {selectedGig.dropoffLocation.address || selectedGig.dropoffLocation.name}</p>

                <div className="pt-0.5 pb-1">
                  <a
                    href={getGoogleMapsDirectionsUrl(selectedGig)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Xem trước tuyến đường trên Google Maps ↗</span>
                  </a>
                </div>
                <p><strong>Thù lao thanh toán:</strong> <span className="text-emerald-400 font-bold text-sm">{selectedGig.reward}</span></p>
                <p><strong>Người vận chuyển (Tài xế):</strong> {userProfile?.name || currentUser?.name || 'Ứng viên'} ({userProfile?.phone || currentUser?.phone || 'Chưa cập nhật'})</p>
              </div>

              <div className="space-y-1.5 text-slate-400 text-[11px]">
                <p>✓ Cam kết giữ nguyên vẹn tài liệu/thiết bị trong suốt hành trình.</p>
                <p>✓ Chụp ảnh xác nhận biên bản giao nhận khi người nhận ký xác nhận.</p>
                <p>✓ Bảo hiểm thất lạc hoặc hư hỏng theo chính sách bảo an WorkLink.</p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="In hoặc lưu dạng PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>In biên bản</span>
                </button>

                {currentUser?.role === 'job_seeker' ? (
                  <button
                    onClick={handleSignElectronicContract}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ký điện tử & Nhận vận chuyển</span>
                  </button>
                ) : (
                  <div className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium text-center">
                    Chỉ tài khoản Ứng viên mới nhận được cuốc này
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

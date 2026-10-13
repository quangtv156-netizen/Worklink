import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  X, 
  Save, 
  Package, 
  Navigation
} from 'lucide-react';
import { soundFx } from '../services/soundEffects';

// Haversine formula tính khoảng cách giữa 2 tọa độ GPS (km)
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Địa điểm gợi ý nhanh phổ biến tại Hà Nội
const POPULAR_LOCATIONS = [
  { name: 'The Coffee Lab (Cầu Giấy)', address: '128 Xuân Thủy, Cầu Giấy, Hà Nội', lat: 21.0375, lng: 105.7890 },
  { name: 'Đại học Quốc Gia Hà Nội', address: '144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy', lat: 21.0382, lng: 105.7828 },
  { name: 'Hồ Gươm (Bưu điện HN)', address: 'Đinh Lễ, Tràng Tiền, Hoàn Kiếm, Hà Nội', lat: 21.0285, lng: 105.8542 },
  { name: 'Vincom Bà Triệu', address: '191 Bà Triệu, Lê Đại Hành, Hai Bà Trưng', lat: 21.0118, lng: 105.8496 },
  { name: 'Keangnam Landmark 72', address: 'Phạm Hùng, Mễ Trì, Nam Từ Liêm', lat: 21.0168, lng: 105.7838 }
];

export default function GigEditModal() {
  const { editingGig, setEditingGig, postNewGig, updateGig, currentUser, showToast } = useApp();

  const isCreating = !editingGig?.id || editingGig?.isNew;

  const [form, setForm] = useState({
    title: '',
    reward: '50.000đ',
    rewardNum: 50000,
    time: '30 - 45 phút',
    cargoType: 'Tài liệu / Đồ nhỏ',
    isValuable: false,
    requiresContract: false,
    distanceKm: 3.5,
    note: '',
    sender: currentUser?.name || 'Người gửi hàng',
    receiver: 'Người nhận hàng',
    pickupLocation: {
      name: 'The Coffee Lab Cầu Giấy',
      address: '128 Xuân Thủy, Cầu Giấy, Hà Nội',
      lat: 21.0375,
      lng: 105.7890
    },
    dropoffLocation: {
      name: 'Vincom Bà Triệu',
      address: '191 Bà Triệu, Hai Bà Trưng, Hà Nội',
      lat: 21.0118,
      lng: 105.8496
    }
  });

  const [selectingPoint, setSelectingPoint] = useState('pickup'); // 'pickup' | 'dropoff'
  const selectingPointRef = useRef(selectingPoint);
  useEffect(() => {
    selectingPointRef.current = selectingPoint;
  }, [selectingPoint]);
  const [submitting, setSubmitting] = useState(false);

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Sync state khi modal mở hoặc editingGig thay đổi
  useEffect(() => {
    if (editingGig) {
      if (editingGig.isNew) {
        setForm({
          title: '',
          reward: '50.000đ',
          rewardNum: 50000,
          time: '30 - 45 phút',
          cargoType: 'Tài liệu / Đồ nhỏ',
          isValuable: false,
          requiresContract: false,
          distanceKm: 3.5,
          note: '',
          sender: currentUser?.name || 'Người gửi hàng',
          receiver: '',
          pickupLocation: {
            name: 'The Coffee Lab Cầu Giấy',
            address: '128 Xuân Thủy, Cầu Giấy, Hà Nội',
            lat: 21.0375,
            lng: 105.7890
          },
          dropoffLocation: {
            name: 'Vincom Bà Triệu',
            address: '191 Bà Triệu, Hai Bà Trưng, Hà Nội',
            lat: 21.0118,
            lng: 105.8496
          }
        });
      } else {
        setForm({
          title: editingGig.title || '',
          reward: editingGig.reward || '50.000đ',
          rewardNum: editingGig.rewardNum || 50000,
          time: editingGig.time || '30 - 45 phút',
          cargoType: editingGig.cargoType || 'Tài liệu / Đồ nhỏ',
          isValuable: Boolean(editingGig.isValuable),
          requiresContract: Boolean(editingGig.requiresContract),
          distanceKm: editingGig.distanceKm || 3.5,
          note: editingGig.note || '',
          sender: editingGig.sender || currentUser?.name || '',
          receiver: editingGig.receiver || '',
          pickupLocation: editingGig.pickupLocation || {
            name: 'Điểm lấy hàng',
            address: '',
            lat: 21.0375,
            lng: 105.7890
          },
          dropoffLocation: editingGig.dropoffLocation || {
            name: 'Điểm giao hàng',
            address: '',
            lat: 21.0118,
            lng: 105.8496
          }
        });
      }
    }
  }, [editingGig, currentUser]);

  // Khởi tạo bản đồ Leaflet trong Modal
  useEffect(() => {
    if (!editingGig || !mapContainerRef.current) return;

    // Fix icon marker mặc định
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [21.0285, 105.8150],
        zoom: 12,
        scrollWheelZoom: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Click trên bản đồ để chọn tọa độ
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const roundedLat = Number(lat.toFixed(5));
        const roundedLng = Number(lng.toFixed(5));

        setForm(prev => {
          let newPickup = prev.pickupLocation;
          let newDropoff = prev.dropoffLocation;

          if (selectingPointRef.current === 'pickup') {
            newPickup = {
              ...prev.pickupLocation,
              name: `Điểm lấy [${roundedLat}, ${roundedLng}]`,
              address: `Tọa độ: ${roundedLat}, ${roundedLng}, Hà Nội`,
              lat: roundedLat,
              lng: roundedLng
            };
          } else {
            newDropoff = {
              ...prev.dropoffLocation,
              name: `Điểm giao [${roundedLat}, ${roundedLng}]`,
              address: `Tọa độ: ${roundedLat}, ${roundedLng}, Hà Nội`,
              lat: roundedLat,
              lng: roundedLng
            };
          }

          const dist = calculateHaversineKm(newPickup.lat, newPickup.lng, newDropoff.lat, newDropoff.lng);
          return {
            ...prev,
            pickupLocation: newPickup,
            dropoffLocation: newDropoff,
            distanceKm: dist
          };
        });

        soundFx.playPop();
      });

      // Invalidate size để chống xám bản đồ sau khi modal animate
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 400);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [editingGig]);

  // Cập nhật Markers và Tuyến đường trên bản đồ mỗi khi tọa độ form thay đổi
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const p = form.pickupLocation;
    const d = form.dropoffLocation;

    if (p?.lat && p?.lng) {
      const pickupIcon = L.divIcon({
        className: 'custom-pickup-marker',
        html: `<div style="background-color:#10b981; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; border:2px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.5);">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      L.marker([p.lat, p.lng], { icon: pickupIcon })
        .addTo(group)
        .bindPopup(`<b>Điểm Lấy Hàng:</b><br/>${p.name || ''}<br/><small>${p.address || ''}</small>`)
        .openPopup();
    }

    if (d?.lat && d?.lng) {
      const dropoffIcon = L.divIcon({
        className: 'custom-dropoff-marker',
        html: `<div style="background-color:#ef4444; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; border:2px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.5);">🏁</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      L.marker([d.lat, d.lng], { icon: dropoffIcon })
        .addTo(group)
        .bindPopup(`<b>Điểm Giao Hàng:</b><br/>${d.name || ''}<br/><small>${d.address || ''}</small>`);
    }

    // Vẽ đường nối giữa 2 điểm (Grab route)
    if (p?.lat && p?.lng && d?.lat && d?.lng) {
      const polyline = L.polyline([[p.lat, p.lng], [d.lat, d.lng]], {
        color: '#6366f1',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8'
      }).addTo(group);

      try {
        map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      } catch {}
    }
  }, [form.pickupLocation, form.dropoffLocation]);

  if (!editingGig) return null;

  const handleApplyPresetLocation = (loc, type) => {
    soundFx.playPop();
    setForm(prev => {
      const newPickup = type === 'pickup' ? { ...loc } : prev.pickupLocation;
      const newDropoff = type === 'dropoff' ? { ...loc } : prev.dropoffLocation;
      const dist = calculateHaversineKm(newPickup.lat, newPickup.lng, newDropoff.lat, newDropoff.lng);
      return {
        ...prev,
        pickupLocation: newPickup,
        dropoffLocation: newDropoff,
        distanceKm: dist
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Vui lòng nhập tiêu đề cuốc việc vặt / giao hàng!', 'error');
      return;
    }

    setSubmitting(true);
    soundFx.playPop();

    try {
      const payload = {
        ...form,
        rewardNum: Number(form.rewardNum) || 50000,
        distanceKm: Number(form.distanceKm) || 2.5
      };

      if (isCreating) {
        await postNewGig(payload);
      } else {
        const ok = await updateGig(editingGig.id, payload);
        if (!ok) return;
      }

      setEditingGig(null);
    } catch (err) {
      // Giữ nguyên form nếu có lỗi phát sinh
      // Error đã được showToast trong AppContext
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={() => setEditingGig(null)}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[94vh] bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-950/50 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {isCreating ? '+ Đăng Cuốc Việc Vặt (Giao Hàng Siêu Tốc)' : 'Chỉnh Sửa Cuốc Việc Vặt'}
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {isCreating ? 'Grab-style Instant' : `ID: ${editingGig.id}`}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Chọn điểm lấy, điểm giao trên bản đồ và cấu hình thù lao nhận cuốc tức thì
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditingGig(null)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Section 1: Tiêu đề & Loại hàng */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Tiêu đề công việc / món hàng cần giao <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: Giao gấp túi hồ sơ hợp đồng sang Bà Triệu"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Loại hàng hóa
              </label>
              <select
                value={form.cargoType}
                onChange={e => setForm({ ...form, cargoType: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-sm"
              >
                <option value="Tài liệu / Đồ nhỏ">📄 Tài liệu / Bì thư</option>
                <option value="Đồ ăn / Thức uống">🍔 Đồ ăn / Thức uống</option>
                <option value="Đồ điện tử / Giá trị">📱 Thiết bị điện tử / Giá trị</option>
                <option value="Quần áo / Thời trang">👕 Quần áo / Thời trang</option>
                <option value="Hàng cồng kềnh">📦 Thùng hàng cồng kềnh</option>
                <option value="Khác">✨ Việc vặt khác</option>
              </select>
            </div>
          </div>

          {/* Section 2: Bản đồ Leaflet - Chọn điểm lấy & Giao hàng tương tác */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Bản đồ lộ trình & Tọa độ giao nhận
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                  {form.distanceKm} km (Tự tính Haversine)
                </span>
              </div>

              {/* Toggle Mode: Chọn Pickup vs Dropoff */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectingPoint('pickup')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectingPoint === 'pickup'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>📍 Click chọn Điểm Lấy</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectingPoint('dropoff')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectingPoint === 'dropoff'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🏁 Click chọn Điểm Giao</span>
                </button>
              </div>
            </div>

            {/* Hint hướng dẫn click */}
            <p className="text-[11px] text-slate-400">
              💡 Chế độ hiện tại: <strong className={selectingPoint === 'pickup' ? 'text-emerald-400' : 'text-rose-400'}>
                {selectingPoint === 'pickup' ? 'Đang chọn ĐIỂM LẤY HÀNG (Click bất kỳ vị trí nào trên bản đồ để ghim)' : 'Đang chọn ĐIỂM GIAO HÀNG (Click bất kỳ vị trí nào trên bản đồ để ghim)'}
              </strong>
            </p>

            {/* Container bản đồ */}
            <div 
              ref={mapContainerRef} 
              className="w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-800 z-10"
            />

            {/* Tọa độ chi tiết & Gợi ý điểm nhanh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-1">
                  <span>📍 Điểm lấy (Pickup)</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {form.pickupLocation.lat}, {form.pickupLocation.lng}
                  </span>
                </div>
                <input
                  type="text"
                  value={form.pickupLocation.name}
                  onChange={e => setForm({
                    ...form,
                    pickupLocation: { ...form.pickupLocation, name: e.target.value }
                  })}
                  placeholder="Tên điểm lấy"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white mb-1.5"
                />
                <input
                  type="text"
                  value={form.pickupLocation.address}
                  onChange={e => setForm({
                    ...form,
                    pickupLocation: { ...form.pickupLocation, address: e.target.value }
                  })}
                  placeholder="Địa chỉ chi tiết điểm lấy"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/30">
                <div className="flex items-center justify-between text-xs font-bold text-rose-400 mb-1">
                  <span>🏁 Điểm giao (Dropoff)</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {form.dropoffLocation.lat}, {form.dropoffLocation.lng}
                  </span>
                </div>
                <input
                  type="text"
                  value={form.dropoffLocation.name}
                  onChange={e => setForm({
                    ...form,
                    dropoffLocation: { ...form.dropoffLocation, name: e.target.value }
                  })}
                  placeholder="Tên điểm giao"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white mb-1.5"
                />
                <input
                  type="text"
                  value={form.dropoffLocation.address}
                  onChange={e => setForm({
                    ...form,
                    dropoffLocation: { ...form.dropoffLocation, address: e.target.value }
                  })}
                  placeholder="Địa chỉ chi tiết điểm giao"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
                />
              </div>
            </div>

            {/* Quick landmark chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Gợi ý nhanh:</span>
              {POPULAR_LOCATIONS.map((loc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPresetLocation(loc, selectingPoint)}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
                >
                  {selectingPoint === 'pickup' ? '📍' : '🏁'} {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Phần thưởng, Thời gian & Thông tin liên hệ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Phần thưởng hiển thị
              </label>
              <input
                type="text"
                required
                value={form.reward}
                onChange={e => {
                  const val = e.target.value;
                  const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
                  setForm({ ...form, reward: val, rewardNum: num });
                }}
                placeholder="50.000đ"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Thời gian cần hoàn thành
              </label>
              <input
                type="text"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                placeholder="30 - 45 phút"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Người gửi hàng
              </label>
              <input
                type="text"
                value={form.sender}
                onChange={e => setForm({ ...form, sender: e.target.value })}
                placeholder="Tên / SĐT người gửi"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Người nhận hàng
              </label>
              <input
                type="text"
                value={form.receiver}
                onChange={e => setForm({ ...form, receiver: e.target.value })}
                placeholder="Tên / SĐT người nhận"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-sm"
              />
            </div>
          </div>

          {/* Section 4: Ghi chú giao hàng & Checkboxes cam kết */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Ghi chú giao nhận (Lưu ý cho người nhận việc)
            </label>
            <textarea
              rows={2}
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              placeholder="Ví dụ: Gọi trước khi đến 5 phút, hàng dễ vỡ nhẹ tay, lên tầng 3 bấm chuông..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isValuable}
                onChange={e => setForm({ ...form, isValuable: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
              />
              <div>
                <strong className="text-white block">Hàng có giá trị cao (High Value)</strong>
                <span className="text-[11px] text-slate-400">Yêu cầu người nhận việc đồng kiểm tra trước khi bàn giao</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.requiresContract}
                onChange={e => setForm({ ...form, requiresContract: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
              />
              <div>
                <strong className="text-white block">Yêu cầu ký biên bản / hợp đồng giao nhận</strong>
                <span className="text-[11px] text-slate-400">Ứng viên phải ký xác nhận điện tử trước khi nhận cuốc</span>
              </div>
            </label>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingGig(null)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Đang lưu...' : isCreating ? 'Phát Lệnh Cuốc Việc Vặt' : 'Cập Nhật Cuốc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

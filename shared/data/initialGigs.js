export const initialGigs = [
  {
    id: 'gig-1',
    bookingCode: 'GRAB-EXP-8891',
    title: 'Giao gấp hồ sơ hợp đồng công chứng',
    reward: '85.000đ',
    rewardNum: 85000,
    time: '14:30 hôm nay',
    cargoType: 'Giấy tờ / Tài liệu',
    packageWeight: '< 1 kg (Phong bì A4)',
    paymentMethod: 'Tiền mặt người gửi trả',
    isValuable: true,
    requiresContract: true,
    pickupLocation: {
      name: 'Văn phòng Công chứng Cầu Giấy (126 Trần Đăng Ninh)',
      address: 'Văn phòng Công chứng Cầu Giấy, 126 Trần Đăng Ninh, Dịch Vọng, Cầu Giấy, Hà Nội',
      lat: 21.0368,
      lng: 105.7898
    },
    dropoffLocation: {
      name: 'Vincom Center Bà Triệu (191 Bà Triệu)',
      address: 'Vincom Center Bà Triệu, 191 Bà Triệu, Lê Đại Hành, Hai Bà Trưng, Hà Nội',
      lat: 21.0116,
      lng: 105.8504
    },
    distanceKm: 7.8,
    note: 'Hồ sơ tài liệu quan trọng, cần người cẩn thận, chụp ảnh xác nhận biên bản giao nhận khi ký.',
    senderName: 'Nguyễn Văn Minh',
    senderPhone: '0982 345 123',
    sender: 'Nguyễn Văn Minh (0982 345 123)',
    receiverName: 'Lê Thu Hà',
    receiverPhone: '0974 567 456',
    receiver: 'Lê Thu Hà (0974 567 456)',
    status: 'AVAILABLE'
  },
  {
    id: 'gig-2',
    bookingCode: 'GRAB-EXP-9024',
    title: 'Vận chuyển thùng đồ cá nhân hỗ trợ chuyển trọ sinh viên',
    reward: '150.000đ',
    rewardNum: 150000,
    time: '16:00 chiều nay',
    cargoType: 'Hàng gia dụng',
    packageWeight: 'Khoảng 10-15 kg (2 kiện)',
    paymentMethod: 'Đã thanh toán qua GrabPay',
    isValuable: false,
    requiresContract: false,
    pickupLocation: {
      name: 'Ký túc xá ĐHQGHN (144 Xuân Thủy, Cầu Giấy)',
      address: 'Ký túc xá Đại học Quốc gia Hà Nội, 144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
      lat: 21.0375,
      lng: 105.7815
    },
    dropoffLocation: {
      name: 'Trường Đại học Thủy Lợi (175 Tây Sơn, Đống Đa)',
      address: 'Trường Đại học Thủy Lợi, 175 Tây Sơn, Trung Liệt, Đống Đa, Hà Nội',
      lat: 21.0083,
      lng: 105.8242
    },
    distanceKm: 5.2,
    note: 'Gồm 2 vali kéo và 1 thùng các-tông quần áo, có thể chở bằng xe máy hoặc xe bán tải nhỏ.',
    senderName: 'Trần Quỳnh Trang',
    senderPhone: '0912 888 789',
    sender: 'Trần Quỳnh Trang (0912 888 789)',
    receiverName: 'Trần Quỳnh Trang',
    receiverPhone: '0912 888 789',
    receiver: 'Trần Quỳnh Trang (0912 888 789)',
    status: 'AVAILABLE'
  },
  {
    id: 'gig-3',
    bookingCode: 'GRAB-EXP-4512',
    title: 'Giao hộp bánh kem sinh nhật 2 tầng giữ lạnh',
    reward: '70.000đ',
    rewardNum: 70000,
    time: '18:00 tối nay',
    cargoType: 'Đồ ăn / Bánh ngọt',
    packageWeight: 'Hộp bánh 2.5 kg',
    paymentMethod: 'Tiền mặt người nhận trả',
    isValuable: false,
    requiresContract: false,
    pickupLocation: {
      name: 'Tous Les Jours (Vincom Phạm Ngọc Thạch, Đống Đa)',
      address: 'Tous Les Jours, Vincom Center Phạm Ngọc Thạch, Đống Đa, Hà Nội',
      lat: 21.0076,
      lng: 105.8325
    },
    dropoffLocation: {
      name: 'Vinhomes Royal City (72A Nguyễn Trãi, Thanh Xuân)',
      address: 'Vinhomes Royal City, 72A Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
      lat: 21.0028,
      lng: 105.8155
    },
    distanceKm: 3.5,
    note: 'Cần đi cẩn thận, giữ thăng bằng bánh sinh nhật không bị xô lệch.',
    senderName: 'Tous Les Jours Bakery',
    senderPhone: '0243 999 888',
    sender: 'Tous Les Jours Bakery (0243 999 888)',
    receiverName: 'Phạm Đức Anh',
    receiverPhone: '0963 111 321',
    receiver: 'Phạm Đức Anh (0963 111 321)',
    status: 'AVAILABLE'
  },
  {
    id: 'gig-4',
    bookingCode: 'GRAB-EXP-7760',
    title: 'Giao laptop Macbook Pro bảo hành đến hãng',
    reward: '130.000đ',
    rewardNum: 130000,
    time: '10:00 sáng mai',
    cargoType: 'Hàng giá trị cao',
    packageWeight: 'Laptop 1.8 kg (kèm sạc)',
    paymentMethod: 'Đã thanh toán điện tử',
    isValuable: true,
    requiresContract: true,
    pickupLocation: {
      name: 'Tràng Tiền Plaza (24 Hai Bà Trưng, Hoàn Kiếm)',
      address: 'Tràng Tiền Plaza, 24 Hai Bà Trưng, Tràng Tiền, Hoàn Kiếm, Hà Nội',
      lat: 21.0254,
      lng: 105.8558
    },
    dropoffLocation: {
      name: 'Tòa nhà FPT Tower (10 Phạm Văn Bạch, Cầu Giấy)',
      address: 'FPT Tower, 10 Phạm Văn Bạch, Dịch Vọng, Cầu Giấy, Hà Nội',
      lat: 21.0278,
      lng: 105.7885
    },
    distanceKm: 8.5,
    note: 'Thiết bị điện tử giá trị cao, yêu cầu shipper đã xác minh danh tính và lập biên bản điện tử.',
    senderName: 'Hoàng Long',
    senderPhone: '0945 222 999',
    sender: 'Hoàng Long (0945 222 999)',
    receiverName: 'TTBH Apple Care - FPT Tower',
    receiverPhone: '0904 555 666',
    receiver: 'TTBH Apple Care - FPT Tower (0904 555 666)',
    status: 'AVAILABLE'
  }
];

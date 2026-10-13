# Huong dan chia se WorkLink qua Tunnel cong khai

Cho phep nguoi khac truy cap WorkLink dang chay tren may ban thong qua URL cong khai (ngrok hoac Cloudflare Tunnel).

## Yeu cau
- Docker Desktop dang chay
- WorkLink da khoi dong: docker compose up -d --build
- App dang lang nghe tren cong 5000 (backend + frontend tich hop)

## Cach 1: ngrok (nhanh nhat)

### Buoc 1 - Cai ngrok
Tai tai: https://ngrok.com/download

### Buoc 2 - Dang nhap
ngrok config add-authtoken <TOKEN>
Lay token tai: https://dashboard.ngrok.com/get-started/your-authtoken

### Buoc 3 - Mo tunnel
ngrok http 5000

### Buoc 4 - Lay URL cong khai
Forwarding: https://abc123.ngrok-free.app -> http://localhost:5000
Gui link nay cho tester.

CANH BAO BAO MAT:
- URL thay doi moi lan mo tunnel (goi free)
- Ai co link deu vao duoc - KHONG dung mat khau yeu, KHONG chia se tai khoan admin
- Tat tunnel khi khong can: Ctrl+C

## Cach 2: Cloudflare Tunnel (on dinh hon)

### Buoc 1 - Cai cloudflared
winget install --id Cloudflare.cloudflared

### Buoc 2 - Dang nhap
cloudflared tunnel login

### Buoc 3 - Chay tunnel
cloudflared tunnel --url http://localhost:5000
Se in ra URL dang: https://random-name.trycloudflare.com

## Tai sao khong can cau hinh them CORS?

WorkLink su dung CORS Delegate thong minh:
1. Frontend va Backend cung chay tren MOT cong duy nhat (5000) - day la same-origin, khong can CORS
2. Khi request den qua tunnel, server kiem tra x-forwarded-host header de tu dong cho phep origin khop voi domain tunnel
3. Khong can thay doi ALLOWED_ORIGINS hay bat ky cau hinh nao - plug and play

## Kiem tra nhanh
Sau khi mo tunnel, mo URL trong trinh duyet:
https://<tunnel-url>/api/health
Neu tra ve { "status": "online" } -> thanh cong!

## Luu y bao mat
- Ai co link deu truy cap duoc -> Khong dung mat khau yeu
- Tai khoan admin bi lo -> Khong chia se mat khau admin cho tester
- Du lieu that bi sua/xoa -> Dung DB rieng cho moi truong test
- Tunnel luon mo 24/7 -> Tat ngay khi khong dung (Ctrl+C)

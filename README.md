# TrueRoll TRON Server

실제 TRON Shasta 테스트넷 트랜잭션 발송 서버

## Railway 배포 방법

1. https://railway.app 회원가입
2. New Project → Deploy from GitHub repo
3. 이 저장소 연결
4. 환경변수 설정:
   - `TRON_PRIVATE_KEY`: d4d0c518b1725467fe09b3bc84d955d9107f7444f999b02d5364339d08f01767
5. Deploy 클릭

## 로컬 실행

```bash
npm install
node index.js
```

API: http://localhost:3001

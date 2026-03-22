const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// TronWeb 인스턴스
let TronWeb;
let tronWeb;

// ★★★ 메모리 히스토리 캐시 (최근 100개) ★★★
const historyCache = [];
const MAX_HISTORY = 100;

async function initializeTronWeb() {
    try {
        console.log('⏳ TronWeb 초기화 중...');

        // Dynamic import for TronWeb ESM
        const TronWebModule = await import('tronweb');
        TronWeb = TronWebModule.default || TronWebModule;

        const PRIVATE_KEY = process.env.TRON_PRIVATE_KEY || 'd4d0c518b1725467fe09b3bc84d955d9107f7444f999b02d5364339d08f01767';

        tronWeb = new TronWeb({
            fullHost: 'https://api.shasta.trongrid.io',
            privateKey: PRIVATE_KEY
        });

        const address = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
        console.log('✅ TronWeb 초기화 완료');
        console.log('📍 Address:', address);

        return true;
    } catch (error) {
        console.error('❌ TronWeb 초기화 실패:', error);
        console.error('상세 에러:', error.message);
        return false;
    }
}

// Health check
app.get('/health', async (req, res) => {
    if (!tronWeb) {
        return res.status(503).json({
            status: 'initializing',
            message: 'TronWeb is initializing...'
        });
    }

    try {
        const address = tronWeb.defaultAddress.base58;
        res.json({
            status: 'ok',
            network: 'shasta',
            address: address,
            tronWebReady: true
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// 실제 TRON 트랜잭션 발송
app.get('/api/random/txid', async (req, res) => {
    const gachaId = req.query.gachaId || 'CashGacha';

    try {
        if (!tronWeb) {
            return res.status(503).json({ error: 'TronWeb not initialized' });
        }

        console.log(`[TxID] 요청 - gachaId: ${gachaId}`);

        const fromAddress = tronWeb.defaultAddress.base58;

        // Burn 주소로 1 SUN 전송 (실제 트랜잭션)
        const burnAddress = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';

        console.log('[TxID] 트랜잭션 발송 중...');

        const transaction = await tronWeb.transactionBuilder.sendTrx(
            burnAddress,
            1,
            fromAddress
        );

        const signedTx = await tronWeb.trx.sign(transaction);
        const result = await tronWeb.trx.sendRawTransaction(signedTx);

        if (!result.result) {
            throw new Error('Transaction failed');
        }

        const txId = result.txid || result.transaction.txID;
        console.log('[TxID] ✅ TxID 생성:', txId);

        // 블록 확정 대기
        console.log('[TxID] 블록 확정 대기 중...');
        let blockNumber = null;
        let confirmed = false;

        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const txInfo = await tronWeb.trx.getTransactionInfo(txId);

            if (txInfo.blockNumber) {
                blockNumber = txInfo.blockNumber;
                confirmed = true;
                console.log(`[TxID] ✅ 블록 확정: #${blockNumber}`);
                break;
            }
        }

        if (!confirmed) {
            console.warn('[TxID] ⚠ 블록 미확정 (10초 타임아웃)');
        }

        // 난수 추출
        const lastNibbles = txId.slice(-6);
        const randomValue = parseInt(lastNibbles, 16);

        console.log(`[TxID] 난수: 0x${lastNibbles} = ${randomValue}`);

        res.json({
            success: true,
            txId,
            randomValue,
            blockNumber,
            confirmed,
            gachaId
        });

    } catch (error) {
        console.error('[TxID] ❌ 에러:', error);
        res.status(500).json({ error: error.message });
    }
});

// ★★★ 히스토리 저장 ★★★
app.post('/api/history/add', async (req, res) => {
    try {
        const { userId, txId, equipmentId, rewardCategory, randomValue, blockNumber } = req.body;

        const historyItem = {
            id: Date.now(),
            user_id: userId,
            tx_id: txId,
            equipment_id: equipmentId,
            reward_category: rewardCategory,
            random_value: randomValue,
            block_number: blockNumber,
            timestamp: Math.floor(Date.now() / 1000)
        };

        // 캐시에 추가
        historyCache.unshift(historyItem);

        // 최대 개수 유지
        if (historyCache.length > MAX_HISTORY) {
            historyCache.pop();
        }

        console.log(`[History] 저장 완료: ${userId} - ${equipmentId}`);

        res.json({ success: true });
    } catch (error) {
        console.error('[History] ❌ 에러:', error);
        res.status(500).json({ error: error.message });
    }
});

// ★★★ 최근 히스토리 조회 ★★★
app.get('/api/history/recent', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;

    res.json({
        success: true,
        history: historyCache.slice(0, limit)
    });
});

// ★★★ 배치 난수 생성 (1개 TxID를 10개 구간으로 분할) ★★★
app.get('/api/random/batch', async (req, res) => {
    const count = parseInt(req.query.count) || 10;
    const gachaId = req.query.gachaId || 'CashGacha';

    try {
        if (!tronWeb) {
            return res.status(503).json({ error: 'TronWeb not initialized' });
        }

        console.log(`[Batch] ${count}개 난수 요청 (1개 TxID 구간 분할) - gachaId: ${gachaId}`);

        const fromAddress = tronWeb.defaultAddress.base58;
        const burnAddress = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';

        // 1개 트랜잭션만 발송
        console.log('[Batch] 트랜잭션 발송 중...');

        const transaction = await tronWeb.transactionBuilder.sendTrx(
            burnAddress,
            1,
            fromAddress
        );

        const signedTx = await tronWeb.trx.sign(transaction);
        const result = await tronWeb.trx.sendRawTransaction(signedTx);

        if (!result.result) {
            throw new Error('Transaction failed');
        }

        const txId = result.txid || result.transaction.txID;
        console.log('[Batch] ✅ TxID:', txId);

        // 블록 확정 대기
        console.log('[Batch] 블록 확정 대기 중...');
        let blockNumber = null;
        let confirmed = false;

        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const txInfo = await tronWeb.trx.getTransactionInfo(txId);

            if (txInfo.blockNumber) {
                blockNumber = txInfo.blockNumber;
                confirmed = true;
                console.log(`[Batch] ✅ 블록 확정: #${blockNumber}`);
                break;
            }
        }

        // TxID를 10개 구간으로 분할하여 난수 생성
        const results = [];
        const txIdLength = txId.length; // 64자

        for (let i = 0; i < count; i++) {
            // 각 구간: 6자리 hex
            // 위치: 끝에서부터 (i * 6)번째부터 6자리
            const startPos = txIdLength - (i + 1) * 6;
            const segment = txId.substring(startPos, startPos + 6);
            const randomValue = parseInt(segment, 16);

            console.log(`[Batch] 구간 ${i + 1}: 위치 ${startPos}-${startPos + 5} → ${segment} → ${randomValue}`);

            results.push({
                txId: txId, // 모두 같은 TxID 사용
                randomValue: randomValue,
                blockNumber: blockNumber,
                confirmed: confirmed,
                segment: segment, // 디버깅용
                segmentIndex: i
            });
        }

        console.log(`[Batch] ✅ ${results.length}개 난수 생성 완료 (1개 TxID)`);

        res.json({
            success: true,
            count: results.length,
            gachaId,
            txId: txId, // 단일 TxID
            blockNumber: blockNumber,
            confirmed: confirmed,
            results: results
        });

    } catch (error) {
        console.error('[Batch] ❌ 에러:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('🚀 TrueRoll TRON Server');
    console.log('='.repeat(60));
    console.log(`📡 API: http://localhost:${PORT}`);
    console.log(`🌐 Network: Shasta Testnet`);
    console.log('='.repeat(60));
    console.log('');

    const initialized = await initializeTronWeb();

    if (initialized) {
        console.log('✅ 서버 준비 완료!');
    } else {
        console.log('❌ TronWeb 초기화 실패!');
        console.log('서버는 실행되지만 API 호출이 실패할 수 있습니다.');
    }

    console.log('');
    console.log('='.repeat(60));
});

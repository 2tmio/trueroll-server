const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// TronWeb 인스턴스
let TronWeb;
let tronWeb;

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

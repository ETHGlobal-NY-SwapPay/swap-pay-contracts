// tasks/demo-execute-swappay.ts
import { task } from 'hardhat/config'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, parseUnits } from 'viem'

import { tokenDecimals } from '@/config/const'

// ===== Helpers locales
const BPS_DENOM = 10_000n
const TOTAL_FEE_BPS = 0n // si agregas fee propio, súbelo aquí

const pow10 = (n: number) => 10n ** BigInt(n)

const ceilDiv = (a: bigint, b: bigint) => (a === 0n ? 0n : 1n + (a - 1n) / b)

/** Convierte USD(1e8) -> amountToken en base a precio tokenUSD(1e8) */
const usd1e8ToTokenAmount = (
	usd1e8: bigint,
	decs: number,
	price1e8: bigint
) => {
	// amount = usd * 10^decs / price
	return (usd1e8 * pow10(decs)) / price1e8
}

const IERC20_MIN_ABI = [
	{
		name: 'approve',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'spender', type: 'address' },
			{ name: 'amount', type: 'uint256' }
		],
		outputs: [{ type: 'bool' }]
	},
	{
		name: 'allowance',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'owner', type: 'address' },
			{ name: 'spender', type: 'address' }
		],
		outputs: [{ type: 'uint256' }]
	}
] as const

task(
	'execute',
	'Runs SwapPay.execute to buy a PixelCounterNFT paying in PYUSD (treasury payout)'
).setAction(async (_, hre) => {
	const { viem, deployments, getNamedAccounts } = hre
	const { deployer } = (await getNamedAccounts()) as { deployer: Address }

	const publicClient = await viem.getPublicClient()
	const walletClient = await viem.getWalletClient(deployer)

	// ==== Contracts & addresses
	const { address: swapPayAddr } = (await deployments.get('SwapPay')) as {
		address: Address
	}
	const { address: pixelAddr } = (await deployments.get('PixelCounterNFT')) as {
		address: Address
	}
	const { address: pyusdAddr } = (await deployments.get('PYUSD')) as {
		address: Address
	}
	const { address: daiAddr } = (await deployments.get('DAI')) as {
		address: Address
	}
	const { address: usdcAddr } = (await deployments.get('USDC')) as {
		address: Address
	}
	const { address: linkAddr } = (await deployments.get('LINK')) as {
		address: Address
	}

	const swapPay = await viem.getContractAt('SwapPay', swapPayAddr)
	const pixel = await viem.getContractAt('PixelCounterNFT', pixelAddr)

	// ==== 1) Leer precio del NFT (en PYUSD base units)
	const price: bigint = await pixel.read.getPrice()
	console.log('----------------------------------------------------')
	console.log(`🧾 NFT price (raw): ${price.toString()}`)

	// ==== 2) Asegurar soporte de tokens (Pixel y SwapPay)
	try {
		const supported: boolean = await pixel.read.isTokenSupported([pyusdAddr])
		if (!supported) {
			const h = await pixel.write.addToToken([pyusdAddr], {
				account: deployer
			})
			await publicClient.waitForTransactionReceipt({ hash: h })
			console.log(`✅ PixelCounterNFT.addToToken(PYUSD) tx: ${h}`)
		} else {
			console.log('ℹ️ PixelCounterNFT ya soporta PYUSD')
		}
	} catch {
		console.log(
			'ℹ️ Saltando addToToken en Pixel (prob. ya soportado/owner distinto).'
		)
	}

	for (const t of [pyusdAddr, daiAddr, usdcAddr, linkAddr]) {
		try {
			const ok: boolean = await swapPay.read.isTokenSupported([t])
			if (!ok) {
				const h = await swapPay.write.addToToken([t], { account: deployer })
				await publicClient.waitForTransactionReceipt({ hash: h })
				console.log(`✅ SwapPay.addToToken(${t}) tx: ${h}`)
			}
		} catch {
			/* ya soportado o función restringida */
		}
	}

	// ==== 3) Objetivo USD y gross con fees (+1% buffer)
	// swapPay expone tokenToUsd(token, amount) via Feeds
	const targetUsd1e8: bigint = await (swapPay.read as any).tokenToUsd([
		pyusdAddr,
		price
	])
	const grossUsdNeeded1e8 = ceilDiv(
		targetUsd1e8 * BPS_DENOM,
		BPS_DENOM - TOTAL_FEE_BPS
	)
	const grossWithBuffer1e8 = (grossUsdNeeded1e8 * 101n) / 100n

	console.log(`💵 targetUsd (1e8): ${targetUsd1e8}`)
	console.log(`💵 grossNeeded+fee (1e8): ${grossUsdNeeded1e8}`)
	console.log(`💵 grossWithBuffer (1e8): ${grossWithBuffer1e8}`)

	// ==== 4) Canasta: DAI, USDC, LINK (partes iguales; residuo al último)
	const basket: { addr: Address; symbol: string; decs: number }[] = [
		{ addr: daiAddr, symbol: 'DAI', decs: tokenDecimals.DAI },
		{ addr: usdcAddr, symbol: 'USDC', decs: tokenDecimals.USDC },
		{ addr: linkAddr, symbol: 'LINK', decs: tokenDecimals.LINK }
	]
	const N = BigInt(basket.length)
	const shareUsd1e8 = grossWithBuffer1e8 / N

	// Precios usando los feeds del propio SwapPay (consistentes on-chain)
	const pxs1e8: bigint[] = []
	for (const b of basket) {
		const px = await (swapPay.read as any).tokenToUsd([b.addr, pow10(b.decs)])
		pxs1e8.push(px)
	}

	const inTokens: Address[] = []
	const inAmounts: bigint[] = []
	let accUsd1e8 = 0n

	for (let i = 0; i < basket.length; i++) {
		const b = basket[i]
		let amt: bigint
		if (i < basket.length - 1) {
			amt = usd1e8ToTokenAmount(shareUsd1e8, b.decs, pxs1e8[i])
			if (amt === 0n) amt = 1n
			accUsd1e8 += (amt * pxs1e8[i]) / pow10(b.decs)
		} else {
			const residUsd1e8 =
				grossWithBuffer1e8 > accUsd1e8 ? grossWithBuffer1e8 - accUsd1e8 : 0n
			amt =
				residUsd1e8 === 0n
					? 1n
					: usd1e8ToTokenAmount(residUsd1e8, b.decs, pxs1e8[i])
			if (amt === 0n) amt = 1n
		}
		inTokens.push(b.addr)
		inAmounts.push(amt)
	}

	console.log('🧺 Basket estimada:')
	basket.forEach((b, i) => {
		console.log(`   - ${b.symbol}: amount=${inAmounts[i].toString()}`)
	})

	// ==== 5) Approvals hacia SwapPay (para transferFrom de la canasta)
	for (let i = 0; i < inTokens.length; i++) {
		const tokenAddr = inTokens[i]
		const allowance: bigint = await publicClient.readContract({
			address: tokenAddr,
			abi: IERC20_MIN_ABI,
			functionName: 'allowance',
			args: [deployer, swapPayAddr]
		})

		if (allowance < inAmounts[i]) {
			const h = await walletClient.writeContract({
				address: tokenAddr,
				abi: IERC20_MIN_ABI,
				functionName: 'approve',
				args: [swapPayAddr, inAmounts[i]],
				account: deployer
			})
			await publicClient.waitForTransactionReceipt({ hash: h })
			console.log(
				`✅ approve ${tokenAddr} → SwapPay por ${inAmounts[i].toString()} (tx: ${h})`
			)
		}
	}

	// ==== 6) Calldata buyNFT(_to=deployer, _token=PYUSD)
	const buyCalldata = encodeFunctionData({
		abi: pixel.abi,
		functionName: 'buyNFT',
		args: [deployer, pyusdAddr]
	})

	// ==== 7) Construir args de execute (firma nueva con 6 params)
	const amountPayment = price // PYUSD exacto a pagar desde tesorería
	const minOutPaymentToken = 0n // ignorado por el contrato actual

	const executeArgs = [
		inTokens, // address[] _tokens
		inAmounts, // uint256[] _amounts
		pixelAddr, // address _target
		buyCalldata as Hex, // bytes _callFunctionData
		amountPayment, // uint256 _amount (en PYUSD)
		minOutPaymentToken // uint256 _minOutPaymentToken (ignorado)
	] as const

	// ==== 8) Ejecutar SwapPay
	const executeCalldata = encodeFunctionData({
		abi: swapPay.abi,
		functionName: 'execute',
		args: executeArgs
	})

	const sendRaw = async (tag: string) => {
		const fee = await publicClient.getFeeHistory({
			blockCount: 1,
			rewardPercentiles: [25]
		})
		const base = fee.baseFeePerGas?.[0] ?? parseUnits('1', 9)
		const tip = fee.reward?.[0]?.[0] ?? parseUnits('1', 9)
		const maxFeePerGas = base + tip
		const maxPriorityFeePerGas = tip

		console.log(`⚡ Enviando RAW TX (${tag}) sin simulación...`)
		const txHash = await walletClient.sendTransaction({
			account: deployer,
			to: swapPayAddr,
			data: executeCalldata,
			value: 0n,
			gas: 2_000_000n,
			maxFeePerGas,
			maxPriorityFeePerGas
		})
		console.log('----------------------------------------------------')
		console.log(`📨 Raw tx enviada: ${txHash}`)
		console.log('🧪 Si revierte, tendrás el hash para inspección.')
		return txHash
	}

	try {
		console.log('🚀 Simulando SwapPay.execute…')
		await publicClient.simulateContract({
			address: swapPayAddr,
			abi: swapPay.abi,
			functionName: 'execute',
			args: executeArgs,
			account: deployer
		})

		console.log('🟢 Simulación OK. Enviando transacción…')
		const hash = await walletClient.writeContract({
			address: swapPayAddr,
			abi: swapPay.abi,
			functionName: 'execute',
			args: executeArgs,
			account: deployer
		})

		await publicClient.waitForTransactionReceipt({ hash })
		console.log('----------------------------------------------------')
		console.log(`✅ SwapPay.execute completado. Tx: ${hash}`)
	} catch (err) {
		console.warn(
			'⚠️ Simulación/llamada falló. Enviando RAW TX para obtener hash...'
		)
		await sendRaw('fallback')
	}
})

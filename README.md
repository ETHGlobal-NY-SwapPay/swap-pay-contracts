Esta es una versión más completa. Incluí secciones sobre la arquitectura técnica y la estructura del proyecto, que demuestran un entendimiento profundo y profesionalismo.

Copia y pega esto en tu archivo README.md.

Markdown

# SwapPay Contracts 💸

![ETHGlobal NY](https://img.shields.io/badge/ETHGlobal-NY_2025-blue.svg) ![Ledger Ready](https://img.shields.io/badge/Ledger-Ready-brightgreen.svg) ![Hardhat](https://img.shields.io/badge/Hardhat-3.0-orange.svg) ![Viem](https://img.shields.io/badge/Viem-Ready-violet.svg)

### Un proyecto para el bounty de Ledger en ETHGlobal New York 2025

**SwapPay** es una pasarela de pagos descentralizada que permite a los usuarios comprar activos on-chain (como NFTs) utilizando múltiples tokens ERC20 en una única transacción atómica, segura y transparente gracias a la implementación del estándar **Clear Signing (ERC-7730)** de Ledger.

> **Enlaces Rápidos:**
> * [Video de Demostración](ENLACE_A_TU_VIDEO)
> * [Prueba la dApp en vivo](ENLACE_A_TU_DAPP_DESPLEGADA)

---

## 🚀 El Problema

El usuario promedio de DeFi tiene sus fondos distribuidos en varios tokens. Para comprar un activo con un precio fijado en USDC, se ven obligados a:
1.  Realizar múltiples swaps (ETH -> USDC, DAI -> USDC).
2.  Pagar altas comisiones de gas por cada transacción.
3.  Firmar transacciones complejas ("blind signing"), lo que supone un grave riesgo de seguridad.

## ✅ La Solución SwapPay

SwapPay elimina esta fricción. Nuestra solución permite una compra en un solo clic, orquestando todos los swaps y la transferencia del activo en una única transacción atómica, mientras proporciona una claridad total al usuario a través de su dispositivo Ledger.

---

## 🛠️ Arquitectura Técnica

El ecosistema de SwapPay se compone de varias partes que trabajan en conjunto:

* **Contratos Inteligentes (Este Repositorio):**
    * `SwapPay.sol`: El contrato principal que contiene la lógica de negocio para los swaps (vía Uniswap V3) y la compra.
    * `SwapPayNFT.sol`: Un contrato ERC721 estándar que representa el activo a la venta.
* **Protocolos Externos:**
    * **Uniswap V3:** Utilizado como la fuente de liquidez para realizar los swaps de tokens de forma eficiente.
* **Frontend dApp (No en este repo):**
    * Una interfaz construida con Next.js, React y Viem que permite a los usuarios interactuar con los contratos de forma intuitiva.

---

## 🔬 Flujo Detallado de la Transacción

1.  **Paso 1: Aprobación de Tokens (Acción de Usuario)**
    * El usuario conecta su wallet y selecciona los tokens que desea gastar.
    * El frontend solicita al usuario que apruebe el gasto de cada token para nuestro contrato `SwapPay.sol`.

2.  **Paso 2: Inicio de Compra (Acción de Usuario)**
    * El usuario hace clic en "Comprar". Esto construye la llamada a la función `swapAndBuyNFT()`.

3.  **Paso 3: Firma Clara en Ledger (Experiencia de Usuario)**
    * La dApp envía la transacción al dispositivo Ledger.
    * Gracias a ERC-7730, la pantalla muestra un resumen legible de la operación, previniendo el "blind signing".

    > #### Pantalla del Ledger:
    > ```
    > Review transaction
    > Action: Buy SwapPay NFT
    > Using Token [1]: 0.1 WETH
    > Using Token [2]: 50.0 DAI
    > You get: NFT #42
    > ```

4.  **Paso 4: Ejecución Atómica (Lógica del Contrato)**
    * El contrato `SwapPay.sol` recibe la transacción firmada y ejecuta toda la lógica en orden: recoge los fondos, realiza los swaps, verifica el total, transfiere el NFT y devuelve el cambio. Todo o nada.

---

## 💻 Guía de Desarrollo Local (Paso a Paso)

Sigue esta guía detallada para levantar el proyecto en tu máquina local.

#### Requisitos Previos
* [Node.js](https://nodejs.org/en/) (versión 18 o superior)
* [Git](https://git-scm.com/)

#### 1. Clonar el Repositorio
Abre tu terminal, navega a donde quieras guardar el proyecto y clónalo.
```bash
git clone [https://github.com/ETHGlobal-NY-SwapPay/swap-pay-contracts.git](https://github.com/ETHGlobal-NY-SwapPay/swap-pay-contracts.git)
cd swap-pay-contracts
2. Instalar Dependencias
Este comando descargará todas las librerías necesarias (Hardhat, Viem, etc.) definidas en package.json.

Bash

npm install
3. Configurar el Entorno
Crea una copia del archivo de ejemplo .env.example para guardar tus claves de forma segura.

Bash

cp .env.example .env
Ahora, abre el nuevo archivo .env y rellena las variables:

# Obtén esto de un proveedor como Alchemy o Infura
SEPOLIA_RPC_URL="[https://sepolia.infura.io/v3/TU_API_KEY](https://sepolia.infura.io/v3/TU_API_KEY)"

# Exporta la clave privada de una wallet de prueba (ej. MetaMask). ¡NUNCA uses una clave principal!
SEPOLIA_PRIVATE_KEY="0xTU_CLAVE_PRIVADA"

# Crea una cuenta en Etherscan para obtener una clave API gratuita
ETHERSCAN_API_KEY="TU_CLAVE_DE_ETHERSCAN"
4. Compilar los Contratos
Verifica que todo esté correcto compilando los contratos.

Bash

npx hardhat compile
5. Ejecutar Pruebas
Antes de desplegar, asegúrate de que toda la lógica funciona correctamente ejecutando las pruebas.

Bash

npx hardhat test
🚀 Despliegue en Sepolia
Usamos Hardhat Ignition para un despliegue robusto y repetible.

Verifica tu .env: Asegúrate de que el archivo .env esté completo y que la wallet asociada a tu SEPOLIA_PRIVATE_KEY tenga ETH de prueba de Sepolia.

Ejecuta el Comando de Despliegue:
Este comando leerá tu script de despliegue y subirá los contratos a la red de Sepolia.

Bash

npx hardhat ignition deploy --network sepolia ignition/modules/SwapPay.ts
Una vez finalizado, la terminal te mostrará las direcciones de los contratos desplegados.

📁 Estructura del Proyecto
.
├── contracts/          # Código fuente de los contratos Solidity
│   ├── core/
│   │   ├── SwapPay.sol
│   │   └── SwapPayNFT.sol
│   └── interfaces/
├── ignition/           # Scripts de despliegue de Hardhat Ignition
│   └── modules/
│       └── SwapPay.ts
├── test/               # Pruebas unitarias y de integración
│   ├── SwapPay.test.ts
│   └── SwapPay.sol.test.ts
├── hardhat.config.ts   # Archivo de configuración de Hardhat
└── package.json        # Dependencias y scripts del proyecto

---

## sección 2: Cómo Usar Git para Subir tu Código (`git push`)

Aquí tienes una guía paso a paso para guardar tus cambios en GitHub. Este es el flujo de trabajo que usarás una y otra vez.

### El Flujo de Trabajo Básico: Add -> Commit -> Push

Piensa en esto como un proceso de 3 pasos para guardar tu trabajo:
1.  **Add (Añadir):** Eliges qué archivos modificados quieres guardar.
2.  **Commit (Confirmar):** Creas un "punto de guardado" con los archivos que elegiste y un mensaje que describe los cambios.
3.  **Push (Empujar):** Subes esos "puntos de guardado" a GitHub para que todos en tu equipo los vean.

### Guía Práctica Paso a Paso

Abre la terminal en la carpeta de tu proyecto.

#### Paso 1: Revisa el Estado (`git status`)
Antes de hacer nada, siempre es bueno ver qué ha cambiado. Este es tu comando de seguridad.
```bash
git status
Te mostrará los archivos que has modificado en rojo (modified).

Te mostrará los archivos nuevos que no están en Git en rojo (untracked files).

Paso 2: Añade tus Cambios al "Área de Preparación" (git add)
Ahora tienes que decirle a Git qué cambios exactos quieres guardar en tu próximo "punto de guardado".

Para añadir TODOS los cambios y archivos nuevos (lo más común):

Bash

git add .
(El . significa "todo en este directorio y subdirectorios").

Para añadir solo un archivo específico:

Bash

git add contracts/core/SwapPay.sol
Después de ejecutar git add, si vuelves a escribir git status, verás que los archivos han cambiado de rojo a verde. ¡Están listos para el siguiente paso!

Paso 3: Crea un Punto de Guardado (git commit)
Ahora que tus archivos están preparados, crea el punto de guardado con un mensaje descriptivo. El mensaje es muy importante para que tú y tu equipo sepan qué hiciste.

Bash

git commit -m "feat: Implementa la lógica de swap en el contrato principal"
Buenas prácticas para los mensajes:

Empieza con un tipo: feat: (nueva función), fix: (arreglo de bug), docs: (cambios en la documentación), style:, refactor:, test:.

Sé breve pero descriptivo.

Paso 4: Sube tus Cambios a GitHub (git push)
El último paso es enviar todos tus "commits" (puntos de guardado) que tienes en tu máquina local al repositorio remoto en GitHub.

Bash

git push origin main
origin: Es el nombre por defecto de tu repositorio remoto (el de GitHub).

main: Es el nombre de la rama principal a la que estás subiendo los cambios. (A veces puede ser master).

Resumen Rápido (Cheat Sheet)
Bash

# 1. Revisa qué has cambiado
git status

# 2. Añade todos los cambios para guardarlos
git add .

# 3. Crea un punto de guardado con un mensaje claro
git commit -m "docs: Actualizo el README con la guía de Git"

# 4. Sube los cambios a GitHub
git push origin main
¡Y eso es todo! Repite este ciclo cada vez que completes una parte importante de tu trabajo. ¡Mucho éxito en el hackathon!
```

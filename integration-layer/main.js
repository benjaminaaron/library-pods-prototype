import { getResourceInfo, createContainerAt, getSolidDataset, saveSolidDatasetAt, createSolidDataset, createThing, setThing, getThing, addUrl, addStringNoLocale, solidDatasetAsTurtle, deleteFile, buildThing } from "@inrupt/solid-client"
import { login, logout, getDefaultSession, handleIncomingRedirect } from "@inrupt/solid-client-authn-browser"

const SERVER = "http://localhost:3000"
const POD = "citizen-pod"
const WEBID_CARD_URL = `${SERVER}/${POD}/profile/card`
const APP_CONTAINER = `${SERVER}/${POD}/private/apps/cori/`
const APP_PROFILE_URL = `${APP_CONTAINER}main.ttl`
const ns = "https://example.com/"

const session = getDefaultSession()

const statusEl = document.getElementById("status")
const outputEl = document.getElementById("output")
function setStatus(msg) { statusEl.textContent = msg }
function setOutput(msg) { outputEl.textContent = msg }

async function solidAuth() {
    if (session.info.isLoggedIn) return
    try {
        await login({
            oidcIssuer: SERVER,
            redirectUrl: window.location.href,
            clientName: "cori-integration-layer",
        })
    } catch (err) {
        console.error("Solid login failed:", err)
        throw err
    }
}

async function ensureContainer(url) {
    try {
        await getResourceInfo(url, { fetch: session.fetch })
    } catch (e) {
        if (e?.statusCode === 404) {
            await createContainerAt(url, { fetch: session.fetch })
            return
        }
        if (e?.statusCode === 409) return // container already exists
        throw e
    }
}

async function ensureDataset(url) {
    try {
        return await getSolidDataset(url, { fetch: session.fetch })
    } catch (e) {
        if (e?.statusCode === 404) {
            const empty = createSolidDataset()
            await saveSolidDatasetAt(url, empty, { fetch: session.fetch })
            return empty
        }
        throw e
    }
}

async function ensureAppProfileSpace() {
    console.log("Ensuring app profile space...")
    if (!session.info.isLoggedIn) throw new Error("Not logged in")
    await ensureContainer(`${SERVER}/${POD}/private/`)
    await ensureContainer(`${SERVER}/${POD}/private/apps/`)
    await ensureContainer(APP_CONTAINER)
    await ensureDataset(APP_PROFILE_URL)
}

function userThingUrl() {
    return `${ns}user`
}

async function appProfileRead() {
    await ensureAppProfileSpace()
    const ds = await getSolidDataset(APP_PROFILE_URL, { fetch: session.fetch })
    return solidDatasetAsTurtle(ds)
}

async function appProfileWriteDemo() {
    await ensureAppProfileSpace()
    let ds = await getSolidDataset(APP_PROFILE_URL, { fetch: session.fetch })
    const existing = getThing(ds, userThingUrl())
    const userThing = buildThing(existing ?? createThing({ url: userThingUrl() }))
        .addStringNoLocale(`${ns}pred`, "hello world")
        .addUrl(`${ns}rel`, `${ns}obj`)
        .build()
    ds = setThing(ds, userThing)
    await saveSolidDatasetAt(APP_PROFILE_URL, ds, { fetch: session.fetch })
    return APP_PROFILE_URL
}

async function init() {
    await handleIncomingRedirect({ restorePreviousSession: true })
    if (session.info.isLoggedIn) {
        await ensureAppProfileSpace()
        setStatus(`Logged in\nWebID: ${session.info.webId}\nWebID card: ${WEBID_CARD_URL}\nApp profile: ${APP_PROFILE_URL}`)
    } else {
        setStatus(`Not logged in\nWebID card: ${WEBID_CARD_URL}\nApp profile: ${APP_PROFILE_URL}`)
    }
}

document.getElementById("login").onclick = async () => {
    await solidAuth()
}

document.getElementById("logout").onclick = async () => {
    await logout()
    window.location.reload()
}

document.getElementById("read").onclick = async () => {
    try {
        setOutput("Profile contents:\n\n" + await appProfileRead())
    } catch (e) {
        setOutput("Read error:\n" + (e?.message ?? String(e)))
    }
}

document.getElementById("write").onclick = async () => {
    try {
        const url = await appProfileWriteDemo()
        setOutput(`RDF written to profile:\n${url}`)
    } catch (e) {
        setOutput("Write error:\n" + (e?.message ?? String(e)))
    }
}

document.getElementById("clear").onclick = async () => {
    try {
        await deleteFile(APP_PROFILE_URL, { fetch: session.fetch })
        await ensureAppProfileSpace()
        setOutput("Profile contents:\n\n" + await appProfileRead())
    } catch (e) {
        setOutput("Clear error:\n" + (e?.message ?? String(e)))
    }
}

await init()

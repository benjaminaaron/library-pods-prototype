import { login, logout, getDefaultSession, handleIncomingRedirect } from "@inrupt/solid-client-authn-browser"
import { QueryEngine } from "@comunica/query-sparql-solid"

const SERVER = "http://localhost:3000"
const POD = "dev-pod"
const PROFILE_URL = `${SERVER}/${POD}/profile/card`

let session = getDefaultSession()
const engine = new QueryEngine()

const statusEl = document.getElementById("status")
const outputEl = document.getElementById("output")
function setStatus(msg) { statusEl.textContent = msg }
function setOutput(msg) { outputEl.textContent = msg }

async function solidAuth() {
    if (session && session.info.isLoggedIn) return
    try {
        await login({ oidcIssuer: SERVER, redirectUrl: window.location.href })
    } catch (err) {
        console.error("Solid login failed:", err)
        throw err
    }
}

async function solidRead(callback) {
    await engine.invalidateHttpCache();
    const query = "SELECT * WHERE { ?s ?p ?o }"
    const rows = []
    const bindingsStream = await engine.queryBindings(query, {
        sources: [PROFILE_URL],
        "@comunica/actor-http-inrupt-solid-client-authn:session": session,
    })
    bindingsStream.on("data", (binding) => {
        rows.push(`${binding.get("s").value} ${binding.get("p").value} ${binding.get("o").value}`)
    })
    bindingsStream.on("end", () => callback(rows))
    bindingsStream.on("error", (err) => console.error(err))
}

async function solidWrite(triples) {
    const query = `INSERT DATA { ${triples} }`
    await engine.queryVoid(query, {
        sources: [PROFILE_URL],
        "@comunica/actor-http-inrupt-solid-client-authn:session": session,
    })
}

async function init() {
    await handleIncomingRedirect({ restorePreviousSession: true })
    if (session.info.isLoggedIn) {
        setStatus(`Logged in\nWebID: ${session.info.webId}\nProfile URL: ${PROFILE_URL}`)
    } else {
        setStatus(`Not logged in\nProfile URL: ${PROFILE_URL}`)
    }
}

document.getElementById("login").onclick = async () => {
    await solidAuth()
}

document.getElementById("logout").onclick = async () => {
    await logout()
    window.location.reload()
}

document.getElementById("write").onclick = async () => {
    try {
        const triples = "<https://example.org/sub> <https://example.org/pred> <https://example.org/obj> ."
        await solidWrite(triples)
        setOutput(`RDF written to:\n${PROFILE_URL}`)
    } catch (e) {
        setOutput("Write error:\n" + e.message)
    }
}

document.getElementById("read").onclick = async () => {
    try {
        await solidRead((rows) => {
            setOutput("SPARQL Results:\n\n" + (rows.join("\n") || "(empty)"))
        })
    } catch (e) {
        setOutput("Query error:\n" + e.message)
    }
}

await init()

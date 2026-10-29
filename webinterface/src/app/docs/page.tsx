"use client";

import {useState, type ReactNode, useLayoutEffect} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import "./docs.css";
import {getSession} from "next-auth/react";
import {usePrefsStore} from "@/lib/settings/prefsStore";

const NAV = [
    { id: "overview", label: "Overview" },
    { id: "getting-started", label: "Getting started" },
    { id: "local-agents", label: "Local agents" },
    { id: "cloud-agents", label: "Cloud agents" },
    { id: "projects", label: "Projects & Catalog" },
    { id: "dashboard", label: "Dashboard" },
    { id: "workflows", label: "Workflows" },
] as const;

const SECTION_VIEWPORT = { margin: "-35% 0px -45% 0px", amount: 0 as const };

function DocsSection({
    id,
    onEnter,
    children,
}: {
    id: string;
    onEnter: (id: string) => void;
    children: ReactNode;
}) {
    return (
        <motion.section
            id={id}
            viewport={SECTION_VIEWPORT}
            onViewportEnter={() => onEnter(id)}
        >
            {children}
        </motion.section>
    );
}

export default function DocsPage() {
    const [activeId, setActiveId] = useState<string>("overview");
    const [loggedIn, setLoggedIn] = useState<boolean>(false);

    async function checkSession(){
        const session = await getSession();
        if(session)
            setLoggedIn(true);
    }

    const prefs = usePrefsStore();

    useLayoutEffect(() => {
        checkSession()
    }, []);

    return (
        <div className="docs-shell">
            <header className="docs-header">
                <a href="/" className="docs-header-brand">
                    <img src={prefs.theme == "dark" ? "/wordmark.svg" : "/wordmark-dark.svg"} alt="MYLO" />
                    <span>Docs</span>
                </a>
                <Link href={loggedIn ? "/home" : "/auth"} className="docs-header-cta">
                    {loggedIn ? "Home" : "Get started"}
                </Link>
            </header>

            <div className="docs-layout">
                <aside className="docs-sidebar">
                    <div className="docs-nav" aria-label="Documentation sections">
                        {NAV.map(({ id, label }) => {
                            const isActive = activeId === id;
                            return (
                                <a
                                    key={id}
                                    href={`#${id}`}
                                    className={isActive ? "active" : undefined}
                                    aria-current={isActive ? "location" : undefined}
                                    onClick={() => setActiveId(id)}
                                >
                                    {isActive && (
                                        <motion.span
                                            layoutId="docsNavPill"
                                            className="docs-nav-pill"
                                            transition={{
                                                type: "spring",
                                                stiffness: 380,
                                                damping: 32,
                                            }}
                                        />
                                    )}
                                    <span className="docs-nav-label">{label}</span>
                                </a>
                            );
                        })}
                    </div>
                </aside>

                <article className="docs-article">
                    <h1>MYLO documentation</h1>
                    {/*<p className="docs-lead">*/}
                    {/*    How to run your own local agent and use Visual Neural Network Studio*/}
                    {/*    from the browser — connect, open a project, edit models, and optimize.*/}
                    {/*</p>*/}

                    <DocsSection id="overview" onEnter={setActiveId}>
                        <h2>Overview</h2>
                        <p>
                            MYLO is a browser control plane for designing, editing, analyzing,
                            and optimizing neural networks. The web app never runs ML workloads
                            itself. Every heavy operation, loading models, CSV analysis,
                            architecture edits, training, export, runs on an{" "}
                            <strong>agent</strong>.
                        </p>
                        <div className="docs-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Component</th>
                                        <th>Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Web Interface</td>
                                        <td>
                                            Sign-in, clients, projects, catalog, and the dockable IDE
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Local agent (Desktop)</td>
                                        <td>
                                            ML engine on your machine
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Cloud agent</td>
                                        <td>
                                            Same API in a Docker container provisioned for your session <code>(Currently Disabled)</code>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p>
                            You must be <strong>Connected</strong> to an agent before you can open
                            or create projects. How to connect to an agent is described below.
                        </p>
                    </DocsSection>

                    <DocsSection id="getting-started" onEnter={setActiveId}>
                        <h2>Getting started</h2>
                        <ol>
                            <li>
                                Open the landing page and choose <strong>Get started</strong>, or go
                                to <Link href="/auth">/auth</Link>.
                            </li>
                            <li>
                                Sign in with <strong>GitHub</strong> or <strong>Google</strong>.
                            </li>
                            <li>
                                You land on <strong>Home</strong> — the hub before the IDE.
                            </li>
                        </ol>
                        <div className="docs-table-wrap">
                            <table>
                                <thead>
                                <tr>
                                    <th>Tab</th>
                                    <th>Purpose</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td>Projects</td>
                                    <td>Active and cloud-saved projects</td>
                                </tr>
                                <tr>
                                    <td>Clients</td>
                                    <td>LOCAL / CLOUD agent connections</td>
                                </tr>
                                <tr>
                                    <td>Catalog</td>
                                    <td>Shared projects and models</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                        <p>
                            The connection indicator shows <em>Connected</em>, <em>Connecting</em>,
                            or <em>Offline</em>. Connect a client before opening a project.
                        </p>
                    </DocsSection>

                    <DocsSection id="local-agents" onEnter={setActiveId}>
                        <h2>Local agents</h2>
                        <p>
                            A local agent lets you keep models and compute on a machine in your own network.
                        </p>
                        <h3>1. Get the Desktop Agent:</h3>
                        <p>
                            Clone the <a href="https://github.com/mylo-ai/MYLO-Desktop-Agent">MYLO Desktop Agent</a> repository:
                        </p>

                        <h3>2. Install dependencies</h3>
                        <p>From the agent directory, create a virtual environment and install requirements:</p>
                        <pre>
                            <code>{`cd MYLO-Desktop-Agent
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt`}</code>
                        </pre>

                        <h3>3. Configure host and port</h3>
                        <p>
                            The agent reads <code>.env</code>. A typical local setup:
                        </p>
                        <pre>
                            <code>{`SERVER_IP="127.0.0.1"
SERVER_PORT="8080"`}</code>
                        </pre>
                        <p>
                            Use <code>0.0.0.0</code> only if you intentionally need LAN access.
                            The web Clients form defaults to <code>http://127.0.0.1:8080</code>.
                        </p>

                        <h3>4. Start the agent</h3>
                        <pre>
                            <code>python App.py</code>
                        </pre>
                        <p>
                            Confirm it is up with a health check:
                        </p>
                        <pre>
                            <code>{`curl http://127.0.0.1:8080/
# → {"message": "MYLO AGENT is running!"}`}</code>
                        </pre>

                        <h3>5. Connect from the web app</h3>
                        <ol>
                            <li>
                                Sign in at <Link href="/auth">/auth</Link>, then open{" "}
                                <strong>Home → Clients</strong>.
                            </li>
                            <li>
                                Click <strong>New config</strong>, choose type <strong>LOCAL</strong>.
                            </li>
                            <li>
                                Set a name (for example “My laptop”).
                            </li>
                            <li>
                                Address: <code>http://127.0.0.1:8080</code> (default).
                            </li>
                            <li>
                                API key: any string you choose (the UI defaults to <code>1234</code>).
                                On first connect, the web app initializes the agent session with a
                                hashed form of this key — keep the same key in the Clients config.
                            </li>
                            <li>
                                Save, then select the config. Status should become{" "}
                                <strong>Connected</strong>.
                            </li>
                        </ol>
                        <div className="docs-note">
                            <strong>Tip:</strong> If status stays Offline, confirm the agent process
                            is running, the address matches <code>SERVER_PORT</code>, and nothing
                            else is bound to that port. Restart the agent if a previous session was
                            left half-initialized.
                        </div>
                    </DocsSection>

                    <DocsSection id="cloud-agents" onEnter={setActiveId}>
                        <h2>Cloud agents (Currently Disabled)</h2>
                        <div className={"docs-note"}>
                            <strong>Note:</strong> Cloud agents are currently disabled. This is because hosting them is costly and not yet ready for production use.
                        </div>
                        <p>
                            Prefer not to install anything locally? Create a <strong>CLOUD</strong>{" "}
                            client instead.
                        </p>
                        <ol>
                            <li>
                                Home → <strong>Clients</strong> → <strong>New config</strong>.
                            </li>
                            <li>
                                Type: <strong>CLOUD</strong>, pick a name, save.
                            </li>
                            <li>
                                The app provisions a Docker agent via the orchestrator. You do not
                                enter an address or API key — those are managed securely for you.
                            </li>
                            <li>
                                If the session goes offline, use <strong>Restart</strong> on the
                                client card to spin up a fresh container.
                            </li>
                        </ol>
                        <p>
                            Deleting a CLOUD config also tears down its container.
                        </p>
                    </DocsSection>

                    <DocsSection id="projects" onEnter={setActiveId}>
                        <h2>Projects &amp; Catalog</h2>

                        <h3>Projects</h3>
                        <ul>
                            <li>
                                <strong>New Project</strong> — name it and open an empty Dashboard
                                (requires Connected).
                            </li>
                            <li>
                                <strong>Open</strong> on an active agent project — continue where
                                you left off.
                            </li>
                            <li>
                                <strong>Upload Project</strong> — load a <code>.mylo</code> file
                                from disk into the agent.
                            </li>
                            <li>
                                <strong>Cloud Projects</strong> — open projects saved to your account
                                (downloaded into the agent, then Dashboard).
                            </li>
                        </ul>

                        <h3>Catalog</h3>
                        <p>
                            Shared resources: full projects (<code>.mylo</code>) and standalone
                            models (<code>.pt2</code>, <code>.onnx</code>).{" "}
                            <strong>Open</strong> downloads the asset into your connected agent and
                            opens the Dashboard (editor or visualiser, depending on type).
                        </p>
                    </DocsSection>

                    <DocsSection id="dashboard" onEnter={setActiveId}>
                        <h2>Dashboard</h2>
                        <p>
                            The Dashboard is the main IDE: a menu bar on top and dockable panels you
                            can move, resize, and detach. The MYLO logo returns you to Home.
                        </p>

                        <h3>Project menu</h3>
                        <div className="docs-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Effect</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Save Project</td>
                                        <td>Download a <code>.mylo</code> archive to disk</td>
                                    </tr>
                                    <tr>
                                        <td>Save to Cloud</td>
                                        <td>Store the project in your account</td>
                                    </tr>
                                    <tr>
                                        <td>Open Project</td>
                                        <td>Load a <code>.mylo</code> from a file</td>
                                    </tr>
                                    <tr>
                                        <td>Load Model</td>
                                        <td>Upload <code>.pt2</code> or <code>.onnx</code></td>
                                    </tr>
                                    <tr>
                                        <td>Load CSV</td>
                                        <td>Upload data for analysis and training</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3>View menu</h3>
                        <div className="docs-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Panel</th>
                                        <th>Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Project Manager</td>
                                        <td>Model slots, upload, visualize, edit, optimize</td>
                                    </tr>
                                    <tr>
                                        <td>Dataset Info</td>
                                        <td>CSV stats, correlations, distributions</td>
                                    </tr>
                                    <tr>
                                        <td>Data viewer</td>
                                        <td>Raw table view of your CSV</td>
                                    </tr>
                                    <tr>
                                        <td>Properties</td>
                                        <td>Details for the selected graph node</td>
                                    </tr>
                                    <tr>
                                        <td>AI Assistant</td>
                                        <td>Natural-language help and edits</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p>
                            Model Editor, Optimization, Diagnostics, and Visualiser also open from
                            Project Manager actions.
                        </p>
                    </DocsSection>

                    <DocsSection id="workflows" onEnter={setActiveId}>
                        <h2>Workflows</h2>

                        <h3>CSV and data analysis</h3>
                        <ol>
                            <li>
                                <strong>Project → Load CSV</strong> (or upload from Project Manager).
                            </li>
                            <li>
                                Open <strong>Dataset Info</strong> for column stats, correlation
                                matrix, and quality signals.
                            </li>
                            <li>
                                Use <strong>Data viewer</strong> for the raw rows. Feature and target
                                columns feed Optimization later.
                            </li>
                        </ol>

                        <h3>Visualiser</h3>
                        <p>
                            Read-only graph of layers and data flow. Click a node to inspect it in
                            Properties. Edit architecture in the Model Editor instead.
                        </p>

                        <h3>Model Editor</h3>
                        <ul>
                            <li>Insert or delete layers from the context menu</li>
                            <li>Edit parameters in the side panel</li>
                            <li>Connect compatible ports; invalid edges are rejected</li>
                            <li>Undo / redo from the toolbar</li>
                            <li>Save to validate and persist on the agent</li>
                        </ul>

                        <h3>Optimization</h3>
                        <ol>
                            <li>Open Optimization from a model slot in Project Manager.</li>
                            <li>
                                Set input features, target column, problem type, epochs/generations,
                                strategy (neuroevolution or Optuna), and encoding.
                            </li>
                            <li>
                                Start the run — progress streams live. When finished, review metrics,
                                architecture diffs, and download the optimized model.
                            </li>
                        </ol>
                        <div className="docs-note">
                            <strong>Requirement:</strong> a CSV must be loaded and columns selected
                            correctly before optimization.
                        </div>

                        <h3>Diagnostics</h3>
                        <p>
                            Quick health check without a full optimize: forward pass, shapes,
                            parameter count, and warnings (unused layers, dtype issues, and similar).
                        </p>

                        <h3>AI Assistant</h3>
                        <p>
                            Chat about the current project — describe the architecture, insert
                            layers, ask about CSV correlations, or open panels. After AI edits,
                            review them in the Model Editor and save if they look right.
                        </p>

                        <h3>Save and export</h3>
                        <div className="docs-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Save Project</td>
                                        <td>
                                            <code>.mylo</code> zip (model, CSV, descriptor, reports)
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Save to Cloud</td>
                                        <td>Same content in your account storage</td>
                                    </tr>
                                    <tr>
                                        <td>Download optimized</td>
                                        <td>
                                            Optimized <code>.pt2</code> / <code>.onnx</code> from
                                            Optimization or Project Manager
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </DocsSection>

                        <p>
                            Ready to try it?{" "}
                            <Link href="/auth">Sign in</Link> and connect your agent.
                        </p>

                </article>
            </div>
        </div>
    );
}

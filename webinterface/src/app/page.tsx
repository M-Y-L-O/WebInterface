import HeroSection from "@/components/effects/HeroSection";
import "./landing.css";

export default function Home() {
  return (
    <div className="pageCont">
        <HeroSection />
        <div className={"CentralFeature"}>
            <h1>Create and edit models visually</h1>
            <div className={"videoContainer"}>
                <video autoPlay loop muted className="video-background" src={"/editor.mp4"}></video>
            </div>
            <p>Just add and connect <a className={"highlight"}>nodes.</a> Don't worry about the code, just the <a className={"highlight"}>architecture.</a></p>
        </div>
        <div className={"Feature"}>
            <div className={"textContainer"}>
                <h1>Optimize and Train your models with a single click</h1>
                <p>Model optimization that changes the architecture of your model for better results.</p>
                <p>Model training and diagnostics tools built in.</p>
            </div>
            <video autoPlay loop muted className="video-background" src={"/optimization.mp4"}></video>
        </div>
        <div className={"Feature inverse"}>
            <div className={"textContainer"}>
                <h1>View and analyse your Data with advanced tools</h1>
                <p>Encoding suggestions, data distribution, correlation, quality and more.</p>
                <p>Helps you build a better dataset for your application.</p>
            </div>
            <video autoPlay loop muted className="video-background" src={"/data.mp4"}></video>
        </div>
        <div className={"Feature"}>
            <div className={"textContainer"}>
                <h1>Create easier and faster with the integrated AI agent.</h1>
                <p>Stuck on a problem? Need something done?</p>
                <p>The solution might be just a prompt away!</p>
            </div>
            <video autoPlay loop muted className="video-background" src={"/agent.mp4"}></video>
        </div>
        <div className={"smallFeaturesList"}>

            <div className={"smallFeature"}>
                <h1>Cross Platform</h1>
                <p>Works on Windows, Linux and MacOS, all you need is a browser.</p>
                <img src={"./ss1.png"} alt={"Screenshot"}/>
            </div>

            <div className={"smallFeature"}>
                <h1>Client based</h1>
                <p>Install the client on any machine to offload all the computation to it.</p>
                <img src={"./ss2.png"} alt={"Screenshot"}/>
            </div>

            <div className={"smallFeature"}>
                <h1>Catalogue</h1>
                <p>Share your models for others to use, or find one as a starting point.</p>
                <img src={"./ss3.png"} alt={"Screenshot"}/>
            </div>
        </div>
        <div className={"lastCta"}>
            <h2>Install the client on your machine, and start creating models.</h2>
            <a href={"/auth"} className={"cta"}>Get started</a>
        </div>
        <div className={"footer"}>
            <img className={"logo"} src={"/wordmark.svg"} alt={"MYLO"}/>
            <h1>The visual neural network studio.</h1>
            <div className={"w-full"}/>
            <h2>By Telea Mihai and Robert Benedek.</h2>
        </div>
    </div>
  );
}

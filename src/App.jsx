import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import {
  ArrowDownUp, ArrowRight, BadgeCheck, Bell, CarFront, Check, ChevronDown,
  Clock3, CreditCard, Gauge, History, LocateFixed, LogOut, MapPin, Menu,
  Navigation, Plus, ShieldCheck, Sparkles, UserRound, Wallet, X, Zap
} from "lucide-react";
import { authMode, supabase } from "./supabase";
import { searchBengaluru, getRoadRoute, straightLineEstimate } from "./location";

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41]
});

const money = n => `₹${Math.round(n).toLocaleString("en-IN")}`;
const cabTypes = [
  { id:"mini", name:"Mini", detail:"Affordable everyday rides", rate:13, base:35, eta:"3–5 min", icon:"🚕" },
  { id:"sedan", name:"Prime Sedan", detail:"Extra comfort & legroom", rate:17, base:55, eta:"4–7 min", icon:"🚘" },
  { id:"suv", name:"SUV", detail:"Spacious rides for groups", rate:22, base:75, eta:"6–9 min", icon:"🚙" }
];

function MapAutoFit({ route, pickup, drop }) {
  const map = useMap();
  useEffect(() => {
    const pts = route?.geometry?.length ? route.geometry : [pickup, drop].filter(Boolean).map(p => [p.lat,p.lon]);
    if (pts.length) map.fitBounds(pts, { padding:[35,35], maxZoom:14 });
  }, [route, pickup, drop, map]);
  return null;
}

function LocationInput({ label, value, onChange, onSelect, marker, placeholder }) {
  const [items,setItems] = useState([]);
  const [open,setOpen] = useState(false);
  const [loading,setLoading] = useState(false);
  const timer = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    const close = e => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handle = value => {
    onChange(value);
    setOpen(true);
    clearTimeout(timer.current);
    if (value.trim().length < 2) { setItems([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const results = await searchBengaluru(value);
      setItems(results);
      setLoading(false);
    }, 280);
  };

  return <div className="location-field" ref={wrap}>
    <label>{label}</label>
    <div className="location-input-wrap">
      <span className={`location-dot ${marker}`} />
      <input value={value} onChange={e=>handle(e.target.value)} onFocus={()=>value.length>=2&&setOpen(true)} placeholder={placeholder} autoComplete="off" />
      {loading && <span className="mini-loader" />}
    </div>
    {open && value.trim().length>=2 && <div className="suggestions">
      {items.length ? items.map((p,i)=><button className="suggestion" key={`${p.name}-${i}`} onClick={()=>{onSelect(p);setOpen(false);}}>
        <span className="suggestion-pin"><MapPin size={16}/></span>
        <span><strong>{p.name}</strong><small>{p.label}</small></span>
        <ArrowRight size={15} className="suggestion-arrow"/>
      </button>) : <div className="suggestion-hint">{loading ? "Searching Bengaluru locations…" : "Try a Bengaluru locality, landmark, metro station or PIN code."}</div>}
      <div className="suggestion-foot">Bengaluru-only suggestions · OpenStreetMap + local directory</div>
    </div>}
  </div>;
}

function AuthScreen({ onAuth }) {
  const [mode,setMode] = useState("login");
  const [role,setRole] = useState("passenger");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      let user;
      if (mode === "register" && !/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
        throw new Error("Password must be at least 8 characters and include one capital letter and one special symbol.");
      }
      if (supabase) {
        if (mode==="register") {
          const {data,error} = await supabase.auth.signUp({email,password,options:{data:{name,role}}});
          if (error) throw error;
          if (!data.session) { setError("Account created. Check your email to confirm, then log in."); setMode("login"); return; }
          user = data.user;
        } else {
          const {data,error} = await supabase.auth.signInWithPassword({email,password});
          if (error) throw error;
          user = data.user;
        }
        onAuth({id:user.id,name:user.user_metadata?.name || name || email.split("@")[0],email,role:user.user_metadata?.role || role});
      } else {
        if (mode==="register" && !name.trim()) throw new Error("Please enter your name.");
        const users = JSON.parse(localStorage.getItem("nr_users") || "[]");
        if (mode==="register") {
          if (users.some(u=>u.email.toLowerCase()===email.toLowerCase())) throw new Error("An account with this email already exists.");
          const newUser={id:crypto.randomUUID(),name,email,role,password};
          users.push(newUser); localStorage.setItem("nr_users",JSON.stringify(users));
          onAuth({id:newUser.id,name,email,role});
        } else {
          const found=users.find(u=>u.email.toLowerCase()===email.toLowerCase()&&u.password===password);
          if (!found) throw new Error("Invalid email or password. Register first or check your details.");
          onAuth({id:found.id,name:found.name,email:found.email,role:found.role});
        }
      }
    } catch(err) { setError(err.message || "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <div className="auth-visual">
      <div className="auth-brand"><span className="brand-mark"><Navigation size={20}/></span> namma<span>ride</span></div>
      <div className="auth-copy"><span className="eyebrow light">YOUR CITY. YOUR RIDE.</span><h1>Bengaluru,<br/><em>within reach.</em></h1><p>Thoughtful rides. Clear prices. A smoother way to move through the city you call home.</p>
        <div className="auth-stat-row"><div><strong>80+</strong><small>Localities</small></div><div><strong>3</strong><small>Ride classes</small></div><div><strong>24/7</strong><small>Ready to go</small></div></div>
      </div>
      <div className="auth-bottom">MADE FOR BENGALURU <span>✳</span> BUILT FOR EVERY JOURNEY</div>
    </div>
    <div className="auth-panel">
      <div className="auth-mobile-brand"><span className="brand-mark"><Navigation size={18}/></span> namma<span>ride</span></div>
      <div className="auth-form-card">
        <span className="eyebrow">{mode==="login"?"WELCOME BACK":"GET STARTED"}</span>
        <h2>{mode==="login"?"Good to see you.":"Your next ride starts here."}</h2>
        <p className="muted">{mode==="login"?"Sign in to continue your journey.":"Create an account in less than a minute."}</p>
        <div className="auth-tabs"><button className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("");}}>Log in</button><button className={mode==="register"?"active":""} onClick={()=>{setMode("register");setError("");}}>Create account</button></div>
        <form onSubmit={submit} className="auth-form">
          {mode==="register" && <><label>Full name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/><label>Account type</label><div className="role-select"><button type="button" className={role==="passenger"?"selected":""} onClick={()=>setRole("passenger")}>Passenger</button><button type="button" className={role==="driver"?"selected":""} onClick={()=>setRole("driver")}>Driver</button></div></>}
          <label>Email address</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/>
          <label>Password</label><input type="password" minLength={mode==="register"?8:1} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="register"?"8+ chars, 1 capital & 1 special symbol":"Your password"} required/>
          {mode==="register"&&<small className="password-hint">Must contain at least 8 characters, one uppercase letter (A–Z), and one special symbol (e.g. @, #, !).</small>}
          {error && <div className="form-error">{error}</div>}
          <button className="primary-btn full" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create my account"} <ArrowRight size={17}/></button>
        </form>
        <div className="secure-note"><ShieldCheck size={15}/> {authMode==="supabase"?"Secure Supabase authentication":"Demo mode · Configure Supabase for production authentication"}</div>
      </div>
      <div className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy.</div>
    </div>
  </main>;
}

export default function App() {
  const [user,setUser] = useState(null);
  const [pickup,setPickup] = useState(null);
  const [drop,setDrop] = useState(null);
  const [pickupText,setPickupText] = useState("");
  const [dropText,setDropText] = useState("");
  const [route,setRoute] = useState(null);
  const [routeLoading,setRouteLoading] = useState(false);
  const [routeError,setRouteError] = useState("");
  const [selectedCab,setSelectedCab] = useState("mini");
  const [payment,setPayment] = useState("cash");
  const [bookings,setBookings] = useState(()=>JSON.parse(localStorage.getItem("nr_bookings")||"[]"));
  const [activeRide,setActiveRide] = useState(null);
  const [view,setView] = useState("home");
  const [profileOpen,setProfileOpen] = useState(false);
  const [mobileMenu,setMobileMenu] = useState(false);
  const [notice,setNotice] = useState("");
  const [trackingStep,setTrackingStep] = useState(0);

  useEffect(()=>{
    if (!supabase) {
      const session=localStorage.getItem("nr_session");
      if(session) try { const savedUser=JSON.parse(session); setUser(savedUser); setView(savedUser.role==="driver"?"driver":"home"); } catch {}
    } else {
      supabase.auth.getSession().then(({data})=>{
        const u=data.session?.user;
        if(u) { const signedInUser={id:u.id,name:u.user_metadata?.name||u.email.split("@")[0],email:u.email,role:u.user_metadata?.role||"passenger"}; setUser(signedInUser); setView(signedInUser.role==="driver"?"driver":"home"); }
      });
      const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
        if(!session) setUser(null);
      });
      return ()=>subscription.unsubscribe();
    }
  },[]);

  useEffect(()=>{localStorage.setItem("nr_bookings",JSON.stringify(bookings));},[bookings]);
  useEffect(()=>{if(user&&!supabase)localStorage.setItem("nr_session",JSON.stringify(user));},[user]);
  useEffect(()=>{
    if(notice){const t=setTimeout(()=>setNotice(""),3500);return()=>clearTimeout(t);}
  },[notice]);
  useEffect(()=>{
    if(!activeRide)return;
    const t=setInterval(()=>setTrackingStep(s=>(s+1)%4),5000);
    return()=>clearInterval(t);
  },[activeRide]);

  async function calculateRoute() {
    if(!pickup||!drop){setRouteError("Choose both pickup and drop locations to see your route.");return;}
    if(pickup.lat===drop.lat&&pickup.lon===drop.lon){setRouteError("Pickup and drop must be different locations.");return;}
    setRouteLoading(true);setRouteError("");
    try { setRoute(await getRoadRoute(pickup,drop)); }
    catch {
      setRoute(straightLineEstimate(pickup,drop));
      setRouteError("Live road routing is temporarily unavailable. Showing an approximate straight-line distance instead; road distance may be longer.");
    } finally {setRouteLoading(false);}
  }

  useEffect(()=>{
    if(pickup&&drop) calculateRoute();
    else setRoute(null);
  },[pickup,drop]);

  const selected = cabTypes.find(c=>c.id===selectedCab) || cabTypes[0];
  const fare = route ? selected.base + route.km*selected.rate : 0;

  function choosePickup(p){setPickup(p);setPickupText(p.label);}
  function chooseDrop(p){setDrop(p);setDropText(p.label);}

  function bookRide() {
    if(!user){setNotice("Please sign in to book a ride.");return;}
    if(!pickup||!drop||!route){setNotice("Please select valid pickup and drop locations first.");return;}
    const ride={id:`NR${Date.now().toString().slice(-8)}`,pickup,drop,km:route.km,minutes:route.minutes,cab:selected.name,fare:Math.round(fare),payment,status:"Confirmed",createdAt:new Date().toISOString(),userId:user.id};
    setBookings(prev=>[ride,...prev]);
    setActiveRide(ride);setView("tracking");setNotice("Your ride has been confirmed!");
  }

  function cancelRide(id) {
    setBookings(prev=>prev.map(b=>b.id===id?{...b,status:"Cancelled"}:b));
    if(activeRide?.id===id)setActiveRide(null);
    setNotice("Ride cancelled successfully.");
  }

  async function logout() {
    if(supabase) await supabase.auth.signOut();
    localStorage.removeItem("nr_session");setUser(null);setProfileOpen(false);setView("home");
  }

  if(!user) return <AuthScreen onAuth={u=>{setUser(u);setView(u.role==="driver"?"driver":"home");if(!supabase)localStorage.setItem("nr_session",JSON.stringify(u));}}/>;

  return <div className="app-shell">
    <header className="topbar">
      <button className="mobile-menu-btn" onClick={()=>setMobileMenu(!mobileMenu)}><Menu/></button>
      <button className="brand" onClick={()=>setView("home")}><span className="brand-mark"><Navigation size={19}/></span><span>namma<strong>ride</strong></span></button>
      <nav className={mobileMenu?"nav-links open":"nav-links"}>
        {user.role==="driver" ? <button className={view==="driver"?"nav-active":""} onClick={()=>{setView("driver");setMobileMenu(false);}}>Driver dashboard</button> : <><button className={view==="home"?"nav-active":""} onClick={()=>{setView("home");setMobileMenu(false);}}>Book a ride</button><button className={view==="history"?"nav-active":""} onClick={()=>{setView("history");setMobileMenu(false);}}>My rides</button></>}
      </nav>
      <div className="top-actions"><button className="icon-btn" title="Notifications" onClick={()=>setNotice("You're all caught up.")}><Bell size={18}/></button>
        <button className="profile-chip" onClick={()=>setProfileOpen(!profileOpen)}><span className="avatar">{(user.name||"U").slice(0,1).toUpperCase()}</span><span>{user.name.split(" ")[0]}</span><ChevronDown size={14}/></button>
        {profileOpen&&<div className="profile-menu"><div className="profile-menu-head"><strong>{user.name}</strong><small>{user.email}</small><span className="role-pill">{user.role}</span></div><button onClick={()=>{setView("profile");setProfileOpen(false);}}><UserRound size={16}/> My profile</button><button onClick={logout}><LogOut size={16}/> Sign out</button></div>}
      </div>
    </header>

    <main className="main-content">
      {view==="home"&&user.role!=="driver"&&<>
        <section className="welcome-row"><div><span className="eyebrow">MONDAY TO SUNDAY, CITY TO CITY</span><h1>Where to, <em>{user.name.split(" ")[0]}?</em></h1><p>Your Bengaluru journey, made a little easier.</p></div><div className="welcome-badge"><span><Zap size={16}/></span> Your city, on your time</div></section>
        <div className="booking-layout">
          <section className="booking-card">
            <div className="card-heading"><div><span className="eyebrow">PLAN YOUR JOURNEY</span><h2>Book a ride</h2></div><span className="step-count">01 <i>/</i> 03</span></div>
            <div className="route-inputs">
              <LocationInput label="PICKUP LOCATION" value={pickupText} onChange={v=>{setPickupText(v);setPickup(null);setRoute(null);}} onSelect={choosePickup} marker="green" placeholder="Search a Bengaluru pickup point"/>
              <button className="swap-btn" title="Swap pickup and drop" onClick={()=>{const p=pickup,d=drop;setPickup(d);setDrop(p);setPickupText(d?.label||"");setDropText(p?.label||"");}}><ArrowDownUp size={16}/></button>
              <LocationInput label="DROP LOCATION" value={dropText} onChange={v=>{setDropText(v);setDrop(null);setRoute(null);}} onSelect={chooseDrop} marker="red" placeholder="Where are you going?"/>
            </div>
            <div className="route-helper"><LocateFixed size={14}/> Suggestions are limited to Bengaluru, Karnataka.</div>
            <div className="divider-line"/>
            <div className="section-title-row"><div><span className="eyebrow">CHOOSE YOUR RIDE</span><h3>Find your comfort</h3></div><span className="availability"><span/> Cabs available</span></div>
            <div className="cab-options">{cabTypes.map(c=><button key={c.id} onClick={()=>setSelectedCab(c.id)} className={`cab-option ${selectedCab===c.id?"cab-selected":""}`}><span className="cab-emoji">{c.icon}</span><span className="cab-info"><strong>{c.name}</strong><small>{c.detail}</small><small className="cab-eta"><Clock3 size={12}/> {c.eta} away</small></span><span className="cab-price">{route?money(c.base+route.km*c.rate):"—"}</span>{selectedCab===c.id&&<span className="cab-check"><Check size={12}/></span>}</button>)}</div>
            <div className="payment-row"><div><span className="eyebrow">PAYMENT METHOD</span><strong><Wallet size={16}/> How would you like to pay?</strong></div><div className="payment-select">{[["cash","Cash"],["upi","UPI"],["card","Card"]].map(([id,label])=><button key={id} className={payment===id?"payment-active":""} onClick={()=>setPayment(id)}>{label}</button>)}</div></div>
            {routeError&&<div className="route-warning">{routeError}</div>}
            <button className="primary-btn book-btn" disabled={!pickup||!drop||!route||routeLoading} onClick={bookRide}>{routeLoading?"Calculating route…":`Confirm ${selected.name} · ${route?money(fare):"—"}`} <ArrowRight size={18}/></button>
            <p className="estimate-note">Estimated fare · Final fare may vary with traffic and trip conditions.</p>
          </section>
          <section className="map-card">
            <div className="map-topline"><div><span className="eyebrow">LIVE CITY MAP</span><h3>Your route, at a glance</h3></div><span className="map-live"><span/> MAP</span></div>
            <div className="map-wrap"><MapContainer center={[12.9716,77.5946]} zoom={11} scrollWheelZoom={true}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
              {pickup&&<Marker position={[pickup.lat,pickup.lon]} icon={markerIcon}/>}
              {drop&&<Marker position={[drop.lat,drop.lon]} icon={markerIcon}/>}
              {route?.geometry&&<Polyline positions={route.geometry} pathOptions={{color:"#4c6fff",weight:5,opacity:.85}}/>}
              <MapAutoFit route={route} pickup={pickup} drop={drop}/>
            </MapContainer>
              {!pickup&&!drop&&<div className="map-empty"><div className="map-empty-icon"><MapPin size={23}/></div><strong>Bengaluru is yours to explore</strong><span>Add your pickup and drop to preview the route.</span></div>}
            </div>
            <div className="route-stats"><div><span className="stat-icon"><Gauge size={16}/></span><div><small>DISTANCE</small><strong>{route?`${route.km.toFixed(1)} km`:"— km"}</strong></div></div><div><span className="stat-icon"><Clock3 size={16}/></span><div><small>EST. DURATION</small><strong>{route&&!route.approximate?`${Math.round(route.minutes)} min`:"— min"}</strong></div></div></div>
            {route?.approximate&&<p className="map-disclaimer">Approximate straight-line distance, not road distance.</p>}
            <div className="map-footer"><span><ShieldCheck size={14}/> Bengaluru routes</span><span>Powered by OpenStreetMap</span></div>
          </section>
        </div>
        <section className="benefits"><div><span className="benefit-icon"><BadgeCheck/></span><strong>Clear estimates</strong><small>See your fare before you ride.</small></div><div><span className="benefit-icon"><MapPin/></span><strong>Local by design</strong><small>Built around Bengaluru locations.</small></div><div><span className="benefit-icon"><ShieldCheck/></span><strong>Ride with ease</strong><small>Your journey details in one place.</small></div></section>
      </>}

      {view==="tracking"&&user.role!=="driver"&&<section className="page-section"><button className="back-link" onClick={()=>setView("home")}>← Back to booking</button><div className="page-title"><span className="eyebrow">YOUR JOURNEY</span><h1>Ride <em>confirmed.</em></h1><p>Your ride details are ready. This prototype simulates driver progress.</p></div>{activeRide?<div className="tracking-card"><div className="tracking-top"><div><span className="status-pill"><span/> {activeRide.status}</span><h2>{activeRide.id}</h2></div><span className="cab-emoji large">🚘</span></div><div className="tracking-route"><div className="track-point green"/><div><small>PICKUP</small><strong>{activeRide.pickup.name}</strong></div><div className="track-line"/><div className="track-point red"/><div><small>DROP</small><strong>{activeRide.drop.name}</strong></div></div><div className="tracking-progress"><div className="progress-label"><strong>{["Driver assigned","Driver is on the way","Arriving at pickup","Ride in progress"][trackingStep]}</strong><span>Simulated update</span></div><div className="progress-bar"><span style={{width:`${[18,48,75,92][trackingStep]}%`}}/></div></div><div className="tracking-summary"><div><small>DISTANCE</small><strong>{activeRide.km.toFixed(1)} km</strong></div><div><small>FARE</small><strong>{money(activeRide.fare)}</strong></div><div><small>PAYMENT</small><strong>{activeRide.payment.toUpperCase()}</strong></div></div><button className="secondary-btn" onClick={()=>cancelRide(activeRide.id)}>Cancel ride</button></div>:<div className="empty-state">No active ride. <button onClick={()=>setView("home")}>Book a ride</button></div>}</section>}

      {view==="history"&&user.role!=="driver"&&<section className="page-section"><div className="page-title"><span className="eyebrow">YOUR ACTIVITY</span><h1>Ride <em>history.</em></h1><p>Every journey, all in one place.</p></div>{bookings.filter(b=>b.userId===user.id).length?<div className="history-list">{bookings.filter(b=>b.userId===user.id).map(b=><article className="history-card" key={b.id}><div className="history-icon">🚕</div><div className="history-main"><strong>{b.pickup.name} <ArrowRight size={14}/> {b.drop.name}</strong><small>{new Date(b.createdAt).toLocaleString("en-IN")} · {b.id}</small><span className={`history-status ${b.status==="Cancelled"?"cancelled":""}`}>{b.status}</span></div><div className="history-fare"><strong>{money(b.fare)}</strong><small>{b.km.toFixed(1)} km · {b.cab}</small></div>{b.status==="Confirmed"&&<button className="text-action" onClick={()=>cancelRide(b.id)}>Cancel</button>}</article>)}</div>:<div className="empty-state"><History size={30}/><h3>No rides yet</h3><p>Your completed and upcoming rides will appear here.</p><button className="primary-btn" onClick={()=>setView("home")}>Book your first ride <ArrowRight size={16}/></button></div>}</section>}

      {view==="profile"&&<section className="page-section"><div className="page-title"><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your <em>profile.</em></h1><p>Manage your NammaRide account.</p></div><div className="profile-card"><div className="profile-large">{user.name.slice(0,1).toUpperCase()}</div><h2>{user.name}</h2><p>{user.email}</p><span className="role-pill">{user.role}</span><div className="profile-detail"><span>Account ID</span><strong>{user.id.slice(0,14)}</strong></div><div className="profile-detail"><span>Authentication</span><strong>{authMode==="supabase"?"Supabase":"Local demo"}</strong></div><button className="secondary-btn" onClick={logout}><LogOut size={16}/> Sign out</button></div></section>}

      {view==="driver"&&user.role==="driver"&&<section className="page-section"><div className="page-title"><span className="eyebrow">DRIVER WORKSPACE</span><h1>Welcome, <em>{user.name.split(" ")[0]}.</em></h1><p>Your driver dashboard and account overview.</p></div><div className="profile-card driver-profile"><div className="profile-large">{user.name.slice(0,1).toUpperCase()}</div><h2>{user.name}</h2><p>{user.email}</p><span className="role-pill">Verified role: Driver</span><div className="profile-detail"><span>Driver ID</span><strong>{user.id.slice(0,14)}</strong></div><div className="profile-detail"><span>Availability</span><strong>Available</strong></div><div className="profile-detail"><span>Account type</span><strong>Driver</strong></div></div><div className="driver-grid driver-dashboard-grid"><div className="driver-stat"><CarFront/><small>DRIVER STATUS</small><strong>Available</strong></div><div className="driver-stat"><History/><small>YOUR ASSIGNED RIDES</small><strong>0</strong></div><div className="driver-stat"><Wallet/><small>YOUR EARNINGS</small><strong>{money(0)}</strong></div></div><div className="notice-card"><Sparkles/><div><strong>Ready for your rides</strong><p>Your driver account is active. Assigned trips will appear here when driver dispatch is connected.</p></div></div></section>}
    </main>
    <footer className="footer"><span>© 2026 NammaRide</span><span>Made for Bengaluru <i>✳</i></span><span>Academic prototype · v1.0</span></footer>
    {notice&&<div className="toast"><Check size={16}/>{notice}<button onClick={()=>setNotice("")}><X size={14}/></button></div>}
  </div>;
}
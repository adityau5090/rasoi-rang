import { Diya, Mandala } from './Ornaments';

const DISHES = ['Dal Baati Churma', 'Laal Maas', 'Gatte ki Sabzi', 'Ker Sangri', 'Pyaaz Kachori', 'Mirchi Vada', 'Ghevar', 'Malpua', 'Kesar Lassi', 'Bajra Roti'];

export function Hero() {
  return (
    <>
      <section className="hero" aria-label="Welcome">
        <div className="hero-bg" aria-hidden="true"><div className="spin-slow"><Mandala size={560} /></div></div>
        <div className="shell hero-in">
          <div>
            <p className="chip rise" style={{ ['--d' as string]: 0 }}>Marwari kitchen · Dine-in &amp; takeaway</p>
            <h2 className="rise" style={{ ['--d' as string]: 1 }}>Swaad of <em>Rajasthan</em>, served at your table</h2>
            <p className="lead rise" style={{ ['--d' as string]: 2 }}>Pick your dishes, choose Half or Full, and watch your order travel from our kitchen to your plate, live.</p>
            <p className="rise" style={{ ['--d' as string]: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a className="btn" href="#menu">See the menu</a>
              <a className="btn ghost light" href="/orders">Track my orders</a>
            </p>
          </div>
          <div className="arch-wrap rise" style={{ ['--d' as string]: 2 }} aria-hidden="true">
            <div className="arch"><div className="spin-slow"><Mandala size={190} /></div></div>
            <span className="fl f1"><Diya lit /></span>
            <span className="fl f2"><Diya lit /></span>
            <span className="fl f3"><Diya lit /></span>
          </div>
        </div>
      </section>
      <div className="toran" aria-hidden="true" />
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...DISHES, ...DISHES].map((d, i) => <span key={i}>{d}</span>)}
        </div>
      </div>
    </>
  );
}

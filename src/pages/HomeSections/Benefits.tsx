import { motion } from "motion/react";

export default function Benefits() {
  return (
    <section id="results" className="py-24 relative overflow-hidden bg-nma-dark border-y border-white/5">
       <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-nma-purple/10 rounded-full blur-[7.5rem] pointer-events-none" />
       
       <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Sistemul este conceput sa aduca <span className="text-transparent bg-clip-text bg-gradient-to-r from-nma-purple-light to-white">Rezultate.</span>
              </h2>
              <p className="text-lg text-nma-silver-dark mb-8 font-light">
                Indiferent ca alegi E-Commerce sau Social Media, metodologia noastra se bazeaza pe numere, date si optimizare constanta. Nu lasam deciziile la voia intamplarii.
              </p>
              
              <ul className="space-y-6">
                {[
                  { title: "Control", desc: "Invata sa creezi trafic la cerere, fara sa depinzi doar de intamplare." },
                  { title: "Scalabilitate", desc: "Sisteme gandite sa functioneze si atunci cand dormi." },
                  { title: "Independenta", desc: "Tu esti proprietarul brandului tau si al afacerii tale." }
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-4">
                     <div className="w-1.5 h-1.5 rounded-full bg-nma-purple mt-2.5 shrink-0" />
                     <div>
                       <strong className="text-white block mb-1">{item.title}</strong>
                       <span className="text-sm text-nma-silver-dark">{item.desc}</span>
                     </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative aspect-square lg:aspect-auto lg:h-[37.5rem] rounded-3xl overflow-hidden glass-card-purple flex flex-col justify-end p-8"
            >
               {/* Premium dark background — no external dependencies */}
               <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#0a0810] to-black" />
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(109,40,217,0.28)_0%,transparent_60%)]" />
               <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.6) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
               <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/50 to-transparent" />
               <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(112,0,255,0.25)] pointer-events-none" />
               
               <div className="relative z-10 border-l-2 border-nma-purple pl-6 py-2">
                 <p className="text-2xl font-bold text-white mb-2">"Succesul lasa indicii."</p>
                 <p className="text-nma-silver-dark uppercase tracking-widest text-sm text-nma-purple-light">Manifesto NMA</p>
               </div>
            </motion.div>

          </div>
       </div>
    </section>
  );
}

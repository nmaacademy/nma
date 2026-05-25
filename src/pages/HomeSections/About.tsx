import { motion } from "motion/react";
import Lanyard from "../../components/ui/Lanyard/Lanyard";

export default function About() {
  return (
    <section
      id="manifesto"
      className="relative z-10 overflow-visible bg-nma-dark border-t border-white/5 pt-24 pb-0 md:pt-32"
    >
      <div className="max-w-4xl mx-auto px-6 relative z-30">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h2 className="text-[2.125rem] md:text-[2.85rem] font-bold tracking-tight text-white mb-8 leading-tight">
            Nu suntem inca o platforma de <span className="text-nma-purple-light italic">"dezvoltare personala"</span>.
          </h2>

          <div className="space-y-6 text-lg md:text-xl text-nma-silver leading-relaxed font-light">
            <p>
              Am construit NMA pentru cei care s-au saturat de teorie de pe internet
              si vor sa construiasca sisteme care produc bani, ofera control si genereaza libertate.
            </p>
            <p className="text-white font-medium">
              E-commerce si Social Media nu sunt trenduri. Sunt noile fundatii ale afacerilor moderne.
            </p>
            <p>
              Iti dam strategia, pasii, template-urile si mentoratul.
              Tu trebuie sa aduci ambitia si executia.
            </p>
          </div>

          <div className="mt-16 h-24" aria-hidden="true" />
        </motion.div>
      </div>

      <div className="relative z-20 mx-auto -mt-36 mb-[-13rem] h-[28rem] max-w-6xl overflow-visible px-0 md:-mt-44 md:mb-[-21rem] md:h-[40rem]">
        <div className="absolute inset-x-[-10vw] top-0 bottom-0 bg-radial-purple opacity-70 blur-2xl pointer-events-none" />
        <Lanyard
          className="lanyard-manifesto"
          position={[0, 0, 25]}
          gravity={[0, -40, 0]}
          fov={22}
        />
      </div>
      
      {/* Decorative subtle glows */}
      <div className="absolute top-0 left-0 z-0 w-full h-full bg-radial-purple pointer-events-none opacity-50" />
    </section>
  );
}

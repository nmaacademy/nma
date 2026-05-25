import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { userService, UserProfile } from "../../services/userService";
import { courseService } from "../../services/courseService";
import { UserCourse, Course } from "../../types";
import { NmaGlassButton, NmaGlassSurface } from "../../components/ui/nma-glass";
import LogoLoader from "../../components/ui/LogoLoader";

export default function AccountDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [purchases, setPurchases] = React.useState<UserCourse[]>([]);
  const [allCourses, setAllCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      const u = await userService.getProfile();
      const p = await userService.getUserCourses();
      const c = await courseService.getAllCourses();
      setUser(u);
      setPurchases(p);
      setAllCourses(c);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <LogoLoader minHeight={320} />;
  if (!user) return <div className="text-white">Eroare la incarcare.</div>;

  const purchaseMap = new Map(purchases.map(p => [p.course_id, p]));
  const myCoursesDetailed = allCourses.filter(c => purchaseMap.has(c.course_id));
  const availableCourses = allCourses.filter(c => !purchaseMap.has(c.course_id));

  return (
    <div className="space-y-12">

      {/* Hero greeting */}
      <div className="relative">
        <div className="absolute -top-8 -left-6 w-80 h-40 bg-nma-purple/10 blur-[4rem] rounded-full pointer-events-none" />
        <span className="text-nma-purple font-bold text-[0.7rem] uppercase tracking-[0.35em] block mb-3">
          Bun venit înapoi
        </span>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-3 leading-none">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-nma-silver">
            {user.name.split(' ')[0]}.
          </span>
        </h1>
        <p className="text-nma-silver-dark text-lg max-w-md">
          Nu e timp de joacă. Continuă construcția.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NmaGlassSurface radius="2xl" tone="purple" className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-nma-purple/20 blur-2xl rounded-full pointer-events-none" />
          <div className="text-nma-silver-dark text-xs mb-3 font-bold uppercase tracking-[0.2em]">Cursuri Active</div>
          <div className="text-5xl font-black text-white">{purchases.length}</div>
          <div className="text-nma-purple-light text-xs mt-1 uppercase tracking-wider font-semibold">programe</div>
        </NmaGlassSurface>
        <NmaGlassSurface radius="2xl" tone="clear" className="p-6 relative overflow-hidden">
          <div className="text-nma-silver-dark text-xs mb-3 font-bold uppercase tracking-[0.2em]">Status Cont</div>
          <div className="text-2xl font-black text-white flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            Activ
          </div>
          <div className="text-nma-silver-dark/60 text-xs mt-1 uppercase tracking-wider font-semibold">& Protejat</div>
        </NmaGlassSurface>
      </div>

      {/* My Courses */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight">Cursurile Tale</h2>
          <Link to="/dashboard/courses" className="text-nma-purple-light text-sm font-bold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider">
            Vezi toate <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {myCoursesDetailed.length === 0 ? (
          <div className="p-10 border border-nma-purple/15 rounded-2xl bg-nma-purple/[0.04] text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.06)_0%,transparent_70%)] pointer-events-none" />
            <BookOpen className="w-12 h-12 text-nma-purple/40 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Nu ai niciun curs activ</h3>
            <p className="text-nma-silver-dark mb-6">Începe călătoria chiar acum.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myCoursesDetailed.map(course => {
              const purchase = purchaseMap.get(course.course_id);
              const pct = Math.round(purchase?.progress_percent ?? 0);
              const ctaLabel = pct >= 100 ? "Revizionează cursul" : pct > 0 ? "Continuă cursul" : "Începe cursul";
              return (
                <NmaGlassSurface key={course.course_id} radius="2xl" tone="clear" className="p-6 flex flex-col justify-between h-full">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{course.title}</h3>
                    {pct > 0 && (
                      <>
                        <div className="w-full bg-white/10 rounded-full h-1.5 mb-2 mt-4">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-nma-purple"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className={`text-xs text-right ${pct >= 100 ? "text-green-400" : "text-nma-silver-dark"}`}>
                          {pct}% {pct >= 100 ? "Finalizat" : ""}
                        </div>
                      </>
                    )}
                  </div>
                  <NmaGlassButton
                    asChild
                    glow="purple"
                    className="mt-6 w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Link to={`/course/${course.slug}`}>
                      {ctaLabel}
                    </Link>
                  </NmaGlassButton>
                </NmaGlassSurface>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Courses */}
      {availableCourses.length > 0 && (
         <div>
            <h2 className="text-2xl font-black text-white mb-6 tracking-tight">Deblochează următorul nivel</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableCourses.map(course => (
                <NmaGlassSurface
                  key={course.course_id} 
                  radius="2xl"
                  tone="clear"
                  className="group cursor-pointer"
                  onClick={() => navigate(`/courses/${course.slug}`)}
                >
                   <div className="h-32 overflow-hidden relative">
                     <img src={course.thumbnail} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" alt="" />
                     <div className="absolute inset-0 bg-gradient-to-t from-[#141419]/90 to-transparent"></div>
                   </div>
                   <div className="p-6 relative z-10 flex flex-col justify-between h-40">
                     <div>
                       <h3 className="text-lg font-bold text-white">{course.title}</h3>
                       <p className="text-sm text-nma-silver-dark mt-1 line-clamp-2">{course.description}</p>
                     </div>
                     <div className="flex items-center gap-2 text-nma-purple font-semibold text-sm">
                       Află mai multe <ArrowRight className="w-4 h-4" />
                     </div>
                   </div>
                </NmaGlassSurface>
              ))}
            </div>
         </div>
      )}
    </div>
  );
}

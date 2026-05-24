<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\CourseAnnouncement;
use App\Models\User;
use Illuminate\Database\Seeder;

class CourseAnnouncementSeeder extends Seeder
{
    public function run(): void
    {
        $course = Course::where('slug', 'nma-academy-curs-complet')->first();

        if (! $course) {
            $this->command->warn('CourseAnnouncementSeeder: demo course not found — run CourseSeeder first.');
            return;
        }

        // Attach to the admin user when available; created_by is nullable so this
        // is safe even when no admin exists yet.
        $adminId = User::where('role', 'admin')->value('id');

        $announcements = [
            [
                'title'        => 'Bine ai venit în NMA Academy!',
                'body'         => "Salut și bun venit în cursul NMA Academy - Curs Complet!\n\nEști acum parte dintr-o comunitate de antreprenori care construiesc businessuri online profitabile pas cu pas.\n\nÎți recomandăm să începi cu Modulul 1 și să urmezi lecțiile în ordine pentru cel mai bun rezultat. Dacă ai întrebări, folosește secțiunea Comunitate — suntem aici să te ajutăm.",
                'is_pinned'    => true,
                'published_at' => now()->subDays(30),
            ],
            [
                'title'        => 'Actualizare conținut — Modulul 3 extins',
                'body'         => "Am adăugat lecții noi în Modulul 3: Reclame și Scalare.\n\nNoile lecții acoperă strategii avansate de Facebook Ads și un ghid actualizat pentru TikTok Ads în 2026. Dacă ai terminat deja modulul, îți recomandăm să revii și să parcurgi materialul nou.\n\nMultă succes!",
                'is_pinned'    => false,
                'published_at' => now()->subDays(14),
            ],
            [
                'title'        => 'Sesiune live Q&A — înregistrare disponibilă',
                'body'         => "Sesiunea live Q&A din săptămâna trecută a fost înregistrată și este acum disponibilă în secțiunea Lecții.\n\nAm acoperit subiecte precum: alegerea furnizorilor, optimizarea campaniilor și automatizarea comenzilor. Durată: ~90 de minute.\n\nUrmătoarea sesiune live va fi anunțată prin acest sistem. Rămâi pe fază!",
                'is_pinned'    => false,
                'published_at' => now()->subDays(5),
            ],
        ];

        foreach ($announcements as $data) {
            CourseAnnouncement::updateOrCreate(
                [
                    'course_id' => $course->id,
                    'title'     => $data['title'],
                ],
                [
                    'created_by'   => $adminId,
                    'body'         => $data['body'],
                    'status'       => 'published',
                    'is_pinned'    => $data['is_pinned'],
                    'published_at' => $data['published_at'],
                ]
            );
        }

        $this->command->info('CourseAnnouncementSeeder: 3 demo announcements seeded.');
    }
}

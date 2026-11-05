import type { Post } from './schema';

const base = 'https://nihalmaskey.hashnode.dev';

/** Five Hashnode posts. Dates, titles and summaries from the profile; slugs from the Hashnode feed. */
export const writing: Post[] = [
  {
    date: '2026-10-26',
    title:
      'I built a water + air monitor on an Arduino, and the buzzer tried to kill me',
    summary:
      'UNO R4 WiFi, DS18B20, DHT22, SH1106 OLED and a buzzer. The buzzer jammed because tone() and digitalWrite() shared a pin.',
    href: `${base}/i-built-a-water-air-monitor-on-an-arduino-and-the-buzzer-tried-to-kill-me`,
  },
  {
    date: '2024-05-11',
    title: 'SSH into Docker with Root User',
    summary: 'SSH as root into a container.',
    href: `${base}/ssh-into-docker-with-root-user`,
  },
  {
    date: '2024-04-30',
    title: 'Running laravel on a server',
    summary: 'Nginx, PHP 8.0-FPM, Composer and MySQL on Ubuntu.',
    href: `${base}/running-laravel-on-a-server`,
  },
  {
    date: '2023-01-24',
    title: 'Accessing GitHub in the server using the deploy key',
    summary: 'Per-repo deploy keys.',
    href: `${base}/accessing-github-in-the-server-using-the-deploy-key`,
  },
  {
    date: '2022-01-22',
    title: 'Laravel: Testing, Factory, and Events',
    summary:
      'withoutEvents to fix a NOT NULL user_id set by a creating hook in tests.',
    href: `${base}/laravel-testing-factory-and-events`,
  },
];

import { expect, it } from 'vitest'
import { labelCommand } from '../../src/main/services/labeler'

const commands: [string, string][] = [
  ['node node_modules/vite/bin/vite.js', 'Vite dev server'],
  ['next dev', 'Next.js'],
  ['nuxt dev', 'Nuxt'],
  ['remix dev', 'Remix'],
  ['astro dev', 'Astro'],
  ['webpack serve', 'Webpack'],
  ['parcel serve', 'Parcel'],
  ['metro start', 'Metro'],
  ['storybook dev', 'Storybook'],
  ['vitest --watch', 'Vitest'],
  ['jest --watch', 'Jest'],
  ['tsc --watch', 'TypeScript watcher'],
  ['node tsserver', 'TypeScript language server'],
  ['esbuild --watch', 'esbuild'],
  ['python manage.py runserver', 'Django'],
  ['flask run', 'Flask'],
  ['uvicorn app:app', 'FastAPI / Uvicorn'],
  ['gunicorn app:app', 'Gunicorn'],
  ['rails s', 'Rails'],
  ['puma', 'Puma'],
  ['java org.springframework.boot.Loader', 'Spring Boot'],
  ['java GradleDaemon', 'Gradle daemon'],
  ['java KotlinCompileDaemon', 'Kotlin daemon'],
  ['postgres -D data', 'Postgres'],
  ['mysqld', 'MySQL'],
  ['redis-server', 'Redis'],
  ['mongod', 'MongoDB'],
  ['java kafka.Kafka', 'Kafka'],
  ['rabbitmq server', 'RabbitMQ'],
  ['java elasticsearch', 'Elasticsearch'],
  ['minio server', 'MinIO'],
  ['mailpit', 'Mailpit'],
  ['mailhog', 'MailHog'],
  ['ngrok http 3000', 'ngrok tunnel'],
  ['cloudflared tunnel', 'Cloudflare tunnel'],
  ['/opt/homebrew/bin/air', 'Go live reload'],
  ['cargo watch -x run', 'Rust watcher'],
  ['php artisan serve', 'Laravel'],
  ['watchman', 'Watchman']
]
it.each(commands)('labels %s as %s', (command, expected) =>
  expect(labelCommand('node', command)).toBe(expected)
)
it('uses npm project scripts and falls back for unknown commands', () => {
  expect(labelCommand('npm', 'npm run dev', { dev: 'vite --host 127.0.0.1' })).toBe(
    'Vite dev server'
  )
  expect(labelCommand('node', 'node server.js')).toBe('node')
  expect(labelCommand('node', 'node invite.js')).toBe('node')
})

export type MockAuthorPackage = {
  id: string
  name: string
  version: string | null
  type: string | null
}

export type MockAuthorPackages = {
  id: string
  name: string
  packages: MockAuthorPackage[]
}

export const topAuthorPackagesMock: MockAuthorPackages[] = [
  {
    "id": "author-Symfony-Community-https-symfony-com-contributors",
    "name": "Symfony Community",
    "packages": [
      {
        "id": "package:symfony/cache",
        "name": "symfony/cache",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/cache-contracts",
        "name": "symfony/cache-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/config",
        "name": "symfony/config",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/console",
        "name": "symfony/console",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/css-selector",
        "name": "symfony/css-selector",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/dependency-injection",
        "name": "symfony/dependency-injection",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/deprecation-contracts",
        "name": "symfony/deprecation-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/dotenv",
        "name": "symfony/dotenv",
        "version": "v7.4.11",
        "type": "library"
      },
      {
        "id": "package:symfony/error-handler",
        "name": "symfony/error-handler",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/event-dispatcher",
        "name": "symfony/event-dispatcher",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/event-dispatcher-contracts",
        "name": "symfony/event-dispatcher-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/filesystem",
        "name": "symfony/filesystem",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/finder",
        "name": "symfony/finder",
        "version": "v7.4.8",
        "type": "library"
      },
      {
        "id": "package:symfony/http-client-contracts",
        "name": "symfony/http-client-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/http-foundation",
        "name": "symfony/http-foundation",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/http-kernel",
        "name": "symfony/http-kernel",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/intl",
        "name": "symfony/intl",
        "version": "v7.4.8",
        "type": "library"
      },
      {
        "id": "package:symfony/mailer",
        "name": "symfony/mailer",
        "version": "v7.4.12",
        "type": "library"
      },
      {
        "id": "package:symfony/mime",
        "name": "symfony/mime",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/options-resolver",
        "name": "symfony/options-resolver",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-ctype",
        "name": "symfony/polyfill-ctype",
        "version": "v1.37.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-deepclone",
        "name": "symfony/polyfill-deepclone",
        "version": "v1.37.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-intl-grapheme",
        "name": "symfony/polyfill-intl-grapheme",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-intl-idn",
        "name": "symfony/polyfill-intl-idn",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-intl-normalizer",
        "name": "symfony/polyfill-intl-normalizer",
        "version": "v1.38.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-mbstring",
        "name": "symfony/polyfill-mbstring",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php73",
        "name": "symfony/polyfill-php73",
        "version": "v1.37.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php80",
        "name": "symfony/polyfill-php80",
        "version": "v1.37.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php81",
        "name": "symfony/polyfill-php81",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php82",
        "name": "symfony/polyfill-php82",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php84",
        "name": "symfony/polyfill-php84",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php85",
        "name": "symfony/polyfill-php85",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/process",
        "name": "symfony/process",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/service-contracts",
        "name": "symfony/service-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/stopwatch",
        "name": "symfony/stopwatch",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/string",
        "name": "symfony/string",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/var-dumper",
        "name": "symfony/var-dumper",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/var-exporter",
        "name": "symfony/var-exporter",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/yaml",
        "name": "symfony/yaml",
        "version": "v8.1.0",
        "type": "library"
      }
    ]
  },
  {
    "id": "author-Sebastian-Bergmann-sebastian-phpunit-de",
    "name": "Sebastian Bergmann",
    "packages": [
      {
        "id": "package:phar-io/manifest",
        "name": "phar-io/manifest",
        "version": "2.0.4",
        "type": "library"
      },
      {
        "id": "package:phar-io/version",
        "name": "phar-io/version",
        "version": "3.2.1",
        "type": "library"
      },
      {
        "id": "package:phpunit/php-code-coverage",
        "name": "phpunit/php-code-coverage",
        "version": "12.5.7",
        "type": "library"
      },
      {
        "id": "package:phpunit/php-file-iterator",
        "name": "phpunit/php-file-iterator",
        "version": "6.0.1",
        "type": "library"
      },
      {
        "id": "package:phpunit/php-invoker",
        "name": "phpunit/php-invoker",
        "version": "6.0.0",
        "type": "library"
      },
      {
        "id": "package:phpunit/php-text-template",
        "name": "phpunit/php-text-template",
        "version": "5.0.0",
        "type": "library"
      },
      {
        "id": "package:phpunit/php-timer",
        "name": "phpunit/php-timer",
        "version": "8.0.0",
        "type": "library"
      },
      {
        "id": "package:phpunit/phpunit",
        "name": "phpunit/phpunit",
        "version": "12.5.28",
        "type": "library"
      },
      {
        "id": "package:sebastian/cli-parser",
        "name": "sebastian/cli-parser",
        "version": "4.2.1",
        "type": "library"
      },
      {
        "id": "package:sebastian/comparator",
        "name": "sebastian/comparator",
        "version": "7.1.8",
        "type": "library"
      },
      {
        "id": "package:sebastian/complexity",
        "name": "sebastian/complexity",
        "version": "5.0.0",
        "type": "library"
      },
      {
        "id": "package:sebastian/diff",
        "name": "sebastian/diff",
        "version": "7.0.0",
        "type": "library"
      },
      {
        "id": "package:sebastian/environment",
        "name": "sebastian/environment",
        "version": "8.1.2",
        "type": "library"
      },
      {
        "id": "package:sebastian/exporter",
        "name": "sebastian/exporter",
        "version": "7.0.3",
        "type": "library"
      },
      {
        "id": "package:sebastian/global-state",
        "name": "sebastian/global-state",
        "version": "8.0.3",
        "type": "library"
      },
      {
        "id": "package:sebastian/lines-of-code",
        "name": "sebastian/lines-of-code",
        "version": "4.0.1",
        "type": "library"
      },
      {
        "id": "package:sebastian/object-enumerator",
        "name": "sebastian/object-enumerator",
        "version": "7.0.0",
        "type": "library"
      },
      {
        "id": "package:sebastian/object-reflector",
        "name": "sebastian/object-reflector",
        "version": "5.0.0",
        "type": "library"
      },
      {
        "id": "package:sebastian/recursion-context",
        "name": "sebastian/recursion-context",
        "version": "7.0.1",
        "type": "library"
      },
      {
        "id": "package:sebastian/type",
        "name": "sebastian/type",
        "version": "6.0.4",
        "type": "library"
      },
      {
        "id": "package:sebastian/version",
        "name": "sebastian/version",
        "version": "6.0.0",
        "type": "library"
      }
    ]
  },
  {
    "id": "author-Nicolas-Grekas-p-tchwork-com",
    "name": "Nicolas Grekas",
    "packages": [
      {
        "id": "package:symfony/cache",
        "name": "symfony/cache",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/cache-contracts",
        "name": "symfony/cache-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/deprecation-contracts",
        "name": "symfony/deprecation-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/event-dispatcher-contracts",
        "name": "symfony/event-dispatcher-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/http-client-contracts",
        "name": "symfony/http-client-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-deepclone",
        "name": "symfony/polyfill-deepclone",
        "version": "v1.37.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-intl-grapheme",
        "name": "symfony/polyfill-intl-grapheme",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-intl-normalizer",
        "name": "symfony/polyfill-intl-normalizer",
        "version": "v1.38.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-mbstring",
        "name": "symfony/polyfill-mbstring",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php73",
        "name": "symfony/polyfill-php73",
        "version": "v1.37.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php80",
        "name": "symfony/polyfill-php80",
        "version": "v1.37.0",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php81",
        "name": "symfony/polyfill-php81",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php82",
        "name": "symfony/polyfill-php82",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php84",
        "name": "symfony/polyfill-php84",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/polyfill-php85",
        "name": "symfony/polyfill-php85",
        "version": "v1.38.1",
        "type": "library"
      },
      {
        "id": "package:symfony/service-contracts",
        "name": "symfony/service-contracts",
        "version": "v3.7.0",
        "type": "library"
      },
      {
        "id": "package:symfony/string",
        "name": "symfony/string",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/var-dumper",
        "name": "symfony/var-dumper",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/var-exporter",
        "name": "symfony/var-exporter",
        "version": "v8.1.0",
        "type": "library"
      }
    ]
  },
  {
    "id": "author-Fabien-Potencier-fabien-symfony-com",
    "name": "Fabien Potencier",
    "packages": [
      {
        "id": "package:friendsofphp/php-cs-fixer",
        "name": "friendsofphp/php-cs-fixer",
        "version": "v3.95.3",
        "type": "application"
      },
      {
        "id": "package:symfony/config",
        "name": "symfony/config",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/console",
        "name": "symfony/console",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/css-selector",
        "name": "symfony/css-selector",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/dependency-injection",
        "name": "symfony/dependency-injection",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/dotenv",
        "name": "symfony/dotenv",
        "version": "v7.4.11",
        "type": "library"
      },
      {
        "id": "package:symfony/error-handler",
        "name": "symfony/error-handler",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/event-dispatcher",
        "name": "symfony/event-dispatcher",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/filesystem",
        "name": "symfony/filesystem",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/finder",
        "name": "symfony/finder",
        "version": "v7.4.8",
        "type": "library"
      },
      {
        "id": "package:symfony/http-foundation",
        "name": "symfony/http-foundation",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/http-kernel",
        "name": "symfony/http-kernel",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/mailer",
        "name": "symfony/mailer",
        "version": "v7.4.12",
        "type": "library"
      },
      {
        "id": "package:symfony/mime",
        "name": "symfony/mime",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/options-resolver",
        "name": "symfony/options-resolver",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/process",
        "name": "symfony/process",
        "version": "v7.4.13",
        "type": "library"
      },
      {
        "id": "package:symfony/stopwatch",
        "name": "symfony/stopwatch",
        "version": "v8.1.0",
        "type": "library"
      },
      {
        "id": "package:symfony/yaml",
        "name": "symfony/yaml",
        "version": "v8.1.0",
        "type": "library"
      }
    ]
  },
  {
    "id": "author-Cees-Jan-Kiewiet-reactphp-ceesjankiewiet-nl-https-wyrihaximus-net",
    "name": "Cees-Jan Kiewiet",
    "packages": [
      {
        "id": "package:react/cache",
        "name": "react/cache",
        "version": "v1.2.0",
        "type": "library"
      },
      {
        "id": "package:react/child-process",
        "name": "react/child-process",
        "version": "v0.6.7",
        "type": "library"
      },
      {
        "id": "package:react/dns",
        "name": "react/dns",
        "version": "v1.14.0",
        "type": "library"
      },
      {
        "id": "package:react/event-loop",
        "name": "react/event-loop",
        "version": "v1.6.0",
        "type": "library"
      },
      {
        "id": "package:react/promise",
        "name": "react/promise",
        "version": "v3.3.0",
        "type": "library"
      },
      {
        "id": "package:react/socket",
        "name": "react/socket",
        "version": "v1.17.0",
        "type": "library"
      },
      {
        "id": "package:react/stream",
        "name": "react/stream",
        "version": "v1.4.0",
        "type": "library"
      }
    ]
  }
]

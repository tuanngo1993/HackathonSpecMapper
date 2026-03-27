# HackathonSpecMapper

Minimal Shopware 6 plugin scaffold for the hackathon AI Technical Spec Mapper idea.

## Local setup

From the Shopware project root:

```bash
php bin/console plugin:refresh
php bin/console plugin:install --activate HackathonSpecMapper
```

## Notes

- This plugin was scaffolded manually following the Shopware plugin base guide.
- The built-in `plugin:create` command was not usable in this environment because local DB access was blocked.

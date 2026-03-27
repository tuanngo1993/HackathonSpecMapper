import './page/sw-hackathon-spec-mapper-settings';

Shopware.Module.register('sw-hackathon-spec-mapper', {
    type: 'plugin',
    name: 'hackathon-spec-mapper',
    title: 'hackathon-spec-mapper.general.mainMenuItemGeneral',
    description: 'hackathon-spec-mapper.general.description',
    version: '0.1.0',
    targetVersion: '0.1.0',
    color: '#6A8695',
    icon: 'regular-cloud-upload',

    routes: {
        index: {
            component: 'sw-hackathon-spec-mapper-settings',
            path: 'index',
            meta: {
                parentPath: 'sw.settings.index',
                privilege: 'system.system_config',
            },
        },
    },

    settingsItem: {
        group: 'plugins',
        to: 'sw.hackathon.spec.mapper.index',
        icon: 'regular-cloud-upload',
        privilege: 'system.system_config',
    },
});

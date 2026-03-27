import HackathonSpecMapperApiService from '../core/service/api/hackathon-spec-mapper.api.service';

Shopware.Service().register('hackathonSpecMapperApiService', () => {
    const initContainer = Shopware.Application.getContainer('init');

    return new HackathonSpecMapperApiService(initContainer.httpClient, Shopware.Service('loginService'));
});

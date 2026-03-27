<?php declare(strict_types=1);

namespace HackathonSpecMapper\Api;

use HackathonSpecMapper\Service\CsvImportPreviewService;
use Shopware\Core\Framework\Api\Response\Type\ApiJsonFullResponse;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\Log\Package;
use Shopware\Core\Framework\Routing\ApiRouteScope;
use Shopware\Core\Framework\Routing\RoutingException;
use Shopware\Core\PlatformRequest;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Package('framework')]
#[Route(defaults: [PlatformRequest::ATTRIBUTE_ROUTE_SCOPE => [ApiRouteScope::ID]])]
class HackathonSpecMapperController
{
    public function __construct(
        private readonly CsvImportPreviewService $csvImportPreviewService,
    ) {
    }

    #[Route(
        path: '/api/_action/hackathon-spec-mapper/format',
        name: 'api.action.hackathon-spec-mapper.format',
        defaults: [PlatformRequest::ATTRIBUTE_ACL => ['system.system_config']],
        methods: ['POST']
    )]
    public function format(Request $request): ApiJsonFullResponse
    {
        $file = $request->files->get('file');

        if (!$file instanceof UploadedFile) {
            throw RoutingException::missingRequestParameter('file');
        }

        return new ApiJsonFullResponse($this->csvImportPreviewService->formatCsv($file));
    }

    #[Route(
        path: '/api/_action/hackathon-spec-mapper/apply',
        name: 'api.action.hackathon-spec-mapper.apply',
        defaults: [PlatformRequest::ATTRIBUTE_ACL => ['system.system_config']],
        methods: ['POST']
    )]
    public function apply(Request $request, Context $context): ApiJsonFullResponse
    {
        $payload = $request->toArray();
        $rows = \is_array($payload['rows'] ?? null) ? $payload['rows'] : [];

        return new ApiJsonFullResponse($this->csvImportPreviewService->applyRows($rows, $context));
    }
}

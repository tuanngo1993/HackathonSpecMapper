<?php declare(strict_types=1);

namespace HackathonSpecMapper\Service;

use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\Log\Package;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Mime\Part\DataPart;
use Symfony\Component\Mime\Part\Multipart\FormDataPart;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Package('framework')]
class CsvImportPreviewService
{
    private const TRANSFORM_ENDPOINT = 'https://csv-transformer-mvp.vercel.app/api/transform-products';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function formatCsv(UploadedFile $file): array
    {
        if (!$file->isValid()) {
            throw new BadRequestHttpException('The uploaded CSV file is invalid.');
        }

        $formData = new FormDataPart([
            'file' => DataPart::fromPath(
                $file->getPathname(),
                $file->getClientOriginalName(),
                $file->getMimeType() ?: 'text/csv',
            ),
        ]);

        try {
            $response = $this->httpClient->request('POST', self::TRANSFORM_ENDPOINT, [
                'headers' => $formData->getPreparedHeaders()->toArray(),
                'body' => $formData->bodyToIterable(),
                'timeout' => 120,
            ]);

            $statusCode = $response->getStatusCode();
            $payload = $response->toArray(false);
        } catch (ExceptionInterface $exception) {
            throw new HttpException(502, 'The CSV transformer API could not be reached.', $exception);
        }

        if (!\is_array($payload)) {
            throw new HttpException(502, 'The CSV transformer API returned an unexpected response.');
        }

        if ($statusCode >= 400) {
            $message = $payload['error'] ?? $payload['message'] ?? 'The CSV transformer API rejected the uploaded file.';

            throw new HttpException($statusCode, (string) $message);
        }

        $payload['fileName'] ??= $file->getClientOriginalName();

        return $payload;
    }

    public function applyRows(array $rows, Context $context): array
    {
        unset($context);

        $approvedRows = \array_values(\array_filter($rows, static function ($row): bool {
            return \is_array($row) && ($row['status'] ?? null) === 'Approved';
        }));

        return [
            'status' => 'accepted',
            'receivedCount' => \count($rows),
            'appliedCount' => \count($approvedRows),
            'todo' => 'TODO: Implement DAL persistence for approved rows and re-fetch current product properties after save.',
        ];
    }
}

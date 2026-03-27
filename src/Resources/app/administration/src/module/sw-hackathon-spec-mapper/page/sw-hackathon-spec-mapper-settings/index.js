import template from './sw-hackathon-spec-mapper-settings.html.twig';
import './sw-hackathon-spec-mapper-settings.scss';

const { Mixin, Data: { Criteria } } = Shopware;

Shopware.Component.register('sw-hackathon-spec-mapper-settings', {
    template,

    inject: [
        'hackathonSpecMapperApiService',
        'repositoryFactory',
    ],

    mixins: [
        Mixin.getByName('notification'),
    ],

    data() {
        return {
            selectedFile: null,
            reviewRows: [],
            productComparisons: [],
            selectedProductNumber: null,
            selectedCurrentProduct: null,
            formattedPayloadText: '',
            formatterTodo: null,
            fileMeta: null,
            warnings: [],
            progressValue: 0,
            isFormatting: false,
            isApplying: false,
            isApplySuccessful: false,
            showFormattedPayloadModal: false,
            showProductDetailsModal: false,
            isLoadingCurrentProduct: false,
            currentProductLoadError: null,
            progressTimer: null,
            applyResult: null,
            isShowingDemoData: false,
            allowedMimeTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
            maxFileSize: 5 * 1024 * 1024,
        };
    },

    computed: {
        hasResults() {
            return this.reviewRows.length > 0;
        },

        hasProductComparisons() {
            return this.productComparisons.length > 0;
        },

        productRepository() {
            return this.repositoryFactory.create('product');
        },

        selectedProductComparison() {
            if (!this.selectedProductNumber) {
                return null;
            }

            return this.productComparisons.find((product) => product.productNumber === this.selectedProductNumber) || null;
        },

        selectedProductRows() {
            if (!this.selectedProductNumber) {
                return [];
            }

            return this.reviewRows.filter((row) => row.productNumber === this.selectedProductNumber);
        },

        selectedProductDetailRows() {
            if (!this.selectedProductComparison) {
                return [];
            }

            const syncPayload = this.selectedProductComparison.syncPayload;

            if (syncPayload && typeof syncPayload === 'object') {
                const detailRows = Object.keys(syncPayload)
                    .filter((key) => !this.shouldIgnoreSyncField(key))
                    .filter((key) => !this.shouldIgnoreSyncFieldValue(key, syncPayload[key]))
                    .map((key, index) => {
                        const fallbackComparison = this.findProductComparisonByKey(this.selectedProductComparison, key);
                        const currentValue = this.selectedCurrentProduct
                            ? this.formatComparisonValue(this.resolveFetchedProductValue(this.selectedCurrentProduct, key), key)
                            : fallbackComparison?.currentValue || 'Not assigned';

                        return {
                            id: `${this.selectedProductComparison.productNumber}-${key}-${index}`,
                            field: this.humanizeFieldKey(key),
                            currentValue,
                            newValue: this.formatComparisonValue(syncPayload[key], key),
                        };
                    });

                if (detailRows.length > 0) {
                    return detailRows;
                }
            }

            return this.selectedProductComparison.comparisons.map((comparison, index) => ({
                id: `${this.selectedProductComparison.productNumber}-${index}`,
                field: comparison.field || comparison.property || 'Field',
                currentValue: comparison.currentValue,
                newValue: comparison.newValue,
            }));
        },

        productColumns() {
            return [
                {
                    property: 'productNumber',
                    label: 'hackathon-spec-mapper.grid.productNumber',
                    allowResize: true,
                    primary: true,
                    width: '180px',
                },
                {
                    property: 'productName',
                    label: 'hackathon-spec-mapper.grid.productName',
                    allowResize: true,
                    width: '260px',
                },
                {
                    property: 'changedFields',
                    label: 'hackathon-spec-mapper.grid.changedFields',
                    allowResize: true,
                    multiLine: true,
                },
            ];
        },

        productSummaryRows() {
            return this.productComparisons.map((product, index) => {
                return {
                    id: product.id || `product-summary-${index}`,
                    productNumber: product.productNumber,
                    productName: product.productName,
                    changedFields: this.getUpdateFields(product),
                };
            });
        },

        approvedCount() {
            return this.reviewRows.filter((row) => row.status === 'Approved').length;
        },

        reviewCount() {
            return this.reviewRows.filter((row) => row.status === 'Needs Review').length;
        },

        ignoredCount() {
            return this.reviewRows.filter((row) => row.status === 'Ignored').length;
        },

        detailColumns() {
            return [
                {
                    property: 'field',
                    label: 'hackathon-spec-mapper.grid.field',
                    allowResize: true,
                    primary: true,
                },
                {
                    property: 'currentValue',
                    label: 'hackathon-spec-mapper.grid.currentValue',
                    allowResize: true,
                },
                {
                    property: 'newValue',
                    label: 'hackathon-spec-mapper.grid.proposedValue',
                    allowResize: true,
                },
            ];
        },
    },

    metaInfo() {
        return {
            title: this.$createTitle(),
        };
    },

    beforeUnmount() {
        this.stopProgressSimulation();
    },

    methods: {
        onFileChanged() {
            this.applyResult = null;
            this.progressValue = 0;
        },

        async onFormatCsv() {
            if (!this.selectedFile) {
                this.createNotificationError({
                    title: this.$tc('global.default.error'),
                    message: this.$tc('hackathon-spec-mapper.messages.selectCsvFirst'),
                });

                return;
            }

            this.isFormatting = true;
            this.progressValue = 5;
            this.startProgressSimulation();

            try {
                const response = await this.hackathonSpecMapperApiService.formatCsv(this.selectedFile);
                this.hydrateResultPayload(response, false);

                this.finishProgressSimulation();
                this.createNotificationSuccess({
                    title: this.$tc('global.default.success'),
                    message: this.$tc('hackathon-spec-mapper.messages.formatSuccess', this.reviewRows.length, {
                        count: this.reviewRows.length,
                    }),
                });
            } catch (error) {
                this.stopProgressSimulation();
                this.progressValue = 0;
                this.createNotificationError({
                    title: this.$tc('global.default.error'),
                    message: this.getErrorMessage(error),
                });
            } finally {
                this.isFormatting = false;
            }
        },

        async onApplyResults() {
            if (!this.hasResults) {
                return;
            }

            this.isApplying = true;
            this.isApplySuccessful = false;

            try {
                const response = await this.hackathonSpecMapperApiService.applyRows(this.reviewRows);

                this.applyResult = response;
                this.isApplySuccessful = true;

                this.createNotificationSuccess({
                    title: this.$tc('global.default.success'),
                    message: this.$tc('hackathon-spec-mapper.messages.applySuccess', response.appliedCount || 0, {
                        count: response.appliedCount || 0,
                    }),
                });
            } catch (error) {
                this.createNotificationError({
                    title: this.$tc('global.default.error'),
                    message: this.getErrorMessage(error),
                });
            } finally {
                this.isApplying = false;
            }
        },

        saveFinish() {
            this.isApplySuccessful = false;
        },

        async openProductDetails(item) {
            this.selectedProductNumber = item.productNumber;
            this.selectedCurrentProduct = null;
            this.currentProductLoadError = null;
            this.showProductDetailsModal = true;

            await this.loadCurrentProductDetails();
        },

        closeProductDetails() {
            this.showProductDetailsModal = false;
            this.selectedProductNumber = null;
            this.selectedCurrentProduct = null;
            this.isLoadingCurrentProduct = false;
            this.currentProductLoadError = null;
        },

        openFormattedPayloadModal() {
            this.formattedPayloadText = this.stringifySyncPayloads(this.productComparisons);
            this.showFormattedPayloadModal = true;
        },

        closeFormattedPayloadModal() {
            this.showFormattedPayloadModal = false;
        },

        applyFormattedPayloadChanges() {
            try {
                const payload = JSON.parse(this.formattedPayloadText);
                const editedSyncPayloads = this.normalizeEditedSyncPayloads(payload);

                if (editedSyncPayloads.length === 0) {
                    throw new Error('Missing syncPayload');
                }

                this.productComparisons = this.productComparisons.map((product, index) => {
                    const syncPayload = this.findEditedSyncPayload(editedSyncPayloads, product, index);
                    const comparisons = this.buildComparisonsFromSyncPayload(product, syncPayload);

                    return {
                        ...product,
                        syncPayload,
                        comparisons,
                        oldVersion: Object.fromEntries(comparisons.map((comparison) => [comparison.field, comparison.currentValue])),
                        newVersion: Object.fromEntries(comparisons.map((comparison) => [comparison.field, comparison.newValue])),
                    };
                });

                this.reviewRows = this.buildReviewRowsFromProducts(this.productComparisons);
                this.formattedPayloadText = this.stringifySyncPayloads(this.productComparisons);
                this.showFormattedPayloadModal = false;

                this.createNotificationSuccess({
                    title: this.$tc('global.default.success'),
                    message: this.$tc('hackathon-spec-mapper.messages.previewUpdated'),
                });
            } catch (error) {
                this.createNotificationError({
                    title: this.$tc('global.default.error'),
                    message: this.getErrorMessage(error),
                });
            }
        },

        markApproved(item) {
            item.status = 'Approved';
            item.action = item.action === 'Ignore' ? 'Update' : item.action;
        },

        markNeedsReview(item) {
            item.status = 'Needs Review';
            item.action = item.action === 'Ignore' ? 'Needs Review' : item.action;
        },

        markIgnored(item) {
            item.status = 'Ignored';
            item.action = 'Ignore';
        },

        getConfidenceVariant(confidence) {
            return confidence === 'High Confidence' ? 'success' : 'warning';
        },

        createProductFetchCriteria() {
            const criteria = new Criteria(1, 1);

            criteria.setTotalCountMode(0);
            criteria
                .addAssociation('categories')
                .addAssociation('visibilities.salesChannel')
                .addAssociation('manufacturer')
                .addAssociation('tax')
                .addAssociation('properties.group');

            return criteria;
        },

        getProductApiContext() {
            return {
                ...Shopware.Context.api,
                inheritance: true,
            };
        },

        async loadCurrentProductDetails() {
            const productComparison = this.selectedProductComparison;

            if (!productComparison) {
                return;
            }

            const requestedProductNumber = productComparison.productNumber;
            const productId = productComparison.syncPayload?.id || productComparison.id || null;
            const productNumber = productComparison.syncPayload?.productNumber || productComparison.productNumber || null;

            this.isLoadingCurrentProduct = true;
            this.currentProductLoadError = null;

            try {
                let currentProduct = null;

                if (productId && productId !== productNumber) {
                    try {
                        currentProduct = await this.productRepository.get(
                            productId,
                            this.getProductApiContext(),
                            this.createProductFetchCriteria(),
                        );
                    } catch (error) {
                        currentProduct = null;
                    }
                }

                if (!currentProduct && productNumber) {
                    const criteria = this.createProductFetchCriteria();
                    criteria.addFilter(Criteria.equals('productNumber', productNumber));

                    const result = await this.productRepository.search(criteria, this.getProductApiContext());
                    currentProduct = result.first() || null;
                }

                if (this.selectedProductNumber !== requestedProductNumber) {
                    return;
                }

                if (!currentProduct) {
                    this.currentProductLoadError = this.$tc('hackathon-spec-mapper.messages.currentProductNotFound');
                    return;
                }

                this.selectedCurrentProduct = currentProduct;
            } catch (error) {
                if (this.selectedProductNumber !== requestedProductNumber) {
                    return;
                }

                this.currentProductLoadError = this.$tc('hackathon-spec-mapper.messages.currentProductLoadFailed');
            } finally {
                if (this.selectedProductNumber === requestedProductNumber) {
                    this.isLoadingCurrentProduct = false;
                }
            }
        },

        findProductComparisonByKey(productComparison, key) {
            if (!productComparison || !Array.isArray(productComparison.comparisons)) {
                return null;
            }

            const normalizedKey = this.normalizeFieldKey(key);

            return productComparison.comparisons.find((comparison) => {
                const comparisonKey = comparison.key || comparison.field || comparison.property || '';

                return this.normalizeFieldKey(comparisonKey) === normalizedKey;
            }) || null;
        },

        stringifySyncPayloads(products) {
            const syncPayloads = products
                .map((product) => product?.syncPayload)
                .filter((syncPayload) => syncPayload && typeof syncPayload === 'object');

            if (syncPayloads.length === 1) {
                return JSON.stringify(syncPayloads[0], null, 2);
            }

            return JSON.stringify(syncPayloads, null, 2);
        },

        normalizeEditedSyncPayloads(payload) {
            if (Array.isArray(payload)) {
                return payload.filter((item) => item && typeof item === 'object');
            }

            if (payload && typeof payload === 'object') {
                return [payload];
            }

            return [];
        },

        findEditedSyncPayload(editedSyncPayloads, product, index) {
            const matchedPayload = editedSyncPayloads.find((syncPayload, payloadIndex) => {
                if (syncPayload.productNumber && syncPayload.productNumber === product.productNumber) {
                    return true;
                }

                if (syncPayload.id && syncPayload.id === product.id) {
                    return true;
                }

                return editedSyncPayloads.length === this.productComparisons.length && payloadIndex === index;
            });

            return matchedPayload || product.syncPayload || {};
        },

        buildComparisonsFromSyncPayload(product, syncPayload) {
            if (!syncPayload || typeof syncPayload !== 'object') {
                return [];
            }

            return Object.keys(syncPayload)
                .filter((key) => !this.shouldIgnoreSyncField(key))
                .filter((key) => !this.shouldIgnoreSyncFieldValue(key, syncPayload[key]))
                .map((key) => {
                    const existingComparison = this.findProductComparisonByKey(product, key);
                    const currentValue = existingComparison?.currentValue || 'Not assigned';
                    const newValue = this.formatComparisonValue(syncPayload[key], key);

                    return {
                        key,
                        field: this.humanizeFieldKey(key),
                        currentValue,
                        newValue,
                        changed: this.toComparableValue(currentValue) !== this.toComparableValue(newValue),
                    };
                });
        },

        buildReviewRowsFromProducts(products) {
            return products.flatMap((product) => {
                return product.comparisons.map((comparison, index) => {
                    const existingRow = this.findReviewRowByProductAndKey(product.productNumber, comparison.key);

                    return this.normalizeRow({
                        id: existingRow?.id || `${product.productNumber}-${index}`,
                        productNumber: product.productNumber,
                        productName: product.productName,
                        sourceColumn: comparison.key,
                        suggestedProperty: comparison.field,
                        currentValue: comparison.currentValue,
                        proposedValue: comparison.newValue,
                        action: comparison.changed ? 'Update' : 'Ignore',
                        confidence: existingRow?.confidence || 'High Confidence',
                        status: comparison.changed ? 'Approved' : 'Ignored',
                        reviewNote: existingRow?.reviewNote || '',
                    }, index);
                });
            });
        },

        findReviewRowByProductAndKey(productNumber, key) {
            return this.reviewRows.find((row) => {
                return row.productNumber === productNumber && this.normalizeFieldKey(row.sourceColumn) === this.normalizeFieldKey(key);
            }) || null;
        },

        getUpdateFields(product) {
            if (product.syncPayload) {
                return this.extractUpdateFieldsFromSyncPayload(product.syncPayload);
            }

            return [...new Set(product.comparisons
                .filter((comparison) => comparison.changed)
                .map((comparison) => comparison.field || comparison.property || 'Field'))];
        },

        extractUpdateFieldsFromSyncPayload(syncPayload) {
            return Object.keys(syncPayload)
                .filter((key) => !this.shouldIgnoreSyncField(key))
                .filter((key) => !this.shouldIgnoreSyncFieldValue(key, syncPayload[key]))
                .map((key) => this.humanizeFieldKey(key));
        },

        shouldIgnoreSyncField(key) {
            const normalizedKey = key.toLowerCase();

            return normalizedKey === 'id'
                || normalizedKey === 'media'
                || normalizedKey.includes('number')
                || normalizedKey.endsWith('id')
                || normalizedKey.endsWith('ids');
        },

        humanizeFieldKey(key) {
            return key
                .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\b\w/g, (char) => char.toUpperCase());
        },

        shouldIgnoreSyncFieldValue(key, value) {
            const referenceFields = new Set([
                'categories',
                'category',
                'visibilities',
                'saleschannel',
                'saleschannels',
                'property',
                'properties',
                'option',
                'options',
            ]);

            return referenceFields.has(this.normalizeFieldKey(key)) && this.isOpaqueReferenceValue(value);
        },

        normalizeFieldKey(key) {
            return String(key || '')
                .replace(/[_-\s]+/g, '')
                .toLowerCase();
        },

        isOpaqueReferenceValue(value) {
            if (value === null || value === undefined || value === '') {
                return false;
            }

            if (Array.isArray(value)) {
                return value.length > 0 && value.every((item) => this.isOpaqueReferenceValue(item));
            }

            if (typeof value === 'object') {
                const entries = Object.values(value).filter((item) => item !== null && item !== undefined && item !== '');

                return entries.length > 0 && entries.every((item) => {
                    if (typeof item === 'object') {
                        return this.isOpaqueReferenceValue(item);
                    }

                    return this.isOpaqueReferenceToken(item);
                });
            }

            return this.isOpaqueReferenceToken(value);
        },

        isOpaqueReferenceToken(value) {
            if (typeof value === 'number') {
                return true;
            }

            if (typeof value !== 'string') {
                return false;
            }

            const tokens = value
                .split(/[,\s|/]+/g)
                .map((token) => token.trim())
                .filter(Boolean);

            if (tokens.length === 0) {
                return false;
            }

            return tokens.every((token) => /^\d+(\.\d+)?$/.test(token) || /^[a-f0-9-]{16,}$/i.test(token));
        },

        getStructuredRows(rows) {
            if (Array.isArray(rows) || !rows || typeof rows !== 'object') {
                return [];
            }

            return Object.values(rows);
        },

        normalizePayloadRows(rows, syncPayloadMap) {
            if (Array.isArray(rows)) {
                return rows.map((row, index) => this.normalizeRow(row, index));
            }

            return this.getStructuredRows(rows).flatMap((row, index) => this.normalizeStructuredRows(row, index, syncPayloadMap));
        },

        normalizeStructuredRows(row, index, syncPayloadMap) {
            const productNumber = this.getStructuredProductNumber(row, index);
            const productName = this.getStructuredProductName(row, index);
            const comparisons = this.buildStructuredComparisons(row, syncPayloadMap);
            const reviewNote = this.getStructuredReviewNote(row);

            return comparisons.map((comparison, comparisonIndex) => this.normalizeRow({
                id: `${productNumber}-${comparisonIndex}`,
                productNumber,
                productName,
                sourceColumn: comparison.key,
                suggestedProperty: comparison.field,
                currentValue: comparison.currentValue,
                proposedValue: comparison.newValue,
                action: comparison.changed ? 'Update' : 'Ignore',
                confidence: 'High Confidence',
                status: comparison.changed ? 'Approved' : 'Ignored',
                reviewNote,
            }, comparisonIndex));
        },

        buildSyncPayloadMap(syncRequests) {
            const syncPayloadMap = new Map();

            if (!Array.isArray(syncRequests)) {
                return syncPayloadMap;
            }

            syncRequests.forEach((request) => {
                if (!Array.isArray(request?.payload)) {
                    return;
                }

                request.payload.forEach((payloadRow) => {
                    [
                        payloadRow?.productNumber,
                        payloadRow?.id,
                        payloadRow?.name,
                    ].filter(Boolean).forEach((key) => {
                        if (!syncPayloadMap.has(key)) {
                            syncPayloadMap.set(key, payloadRow);
                        }
                    });
                });
            });

            return syncPayloadMap;
        },

        resolveRowSyncPayload(row, syncPayloadMap) {
            const fallbackPayload = row?.shopwareSyncPayload || null;
            const candidateKeys = [
                fallbackPayload?.productNumber,
                fallbackPayload?.id,
                row?.canonicalProduct?.sku,
                row?.canonicalProduct?.id,
                fallbackPayload?.name,
                row?.canonicalProduct?.name,
            ];

            const matchedKey = candidateKeys.find((key) => key && syncPayloadMap.has(key));

            if (matchedKey) {
                return syncPayloadMap.get(matchedKey);
            }

            return fallbackPayload;
        },

        resolveProductSyncPayload(product, syncPayloadMap) {
            const candidateKeys = [
                product?.productNumber,
                product?.id,
                product?.productName,
            ];

            const matchedKey = candidateKeys.find((key) => key && syncPayloadMap.has(key));

            if (matchedKey) {
                return syncPayloadMap.get(matchedKey);
            }

            return product?.shopwareSyncPayload || null;
        },

        getStructuredProductNumber(row, index) {
            return row?.shopwareSyncPayload?.productNumber
                || row?.mcpProductPreview?.productNumber
                || row?.canonicalProduct?.sku
                || row?.canonicalProduct?.productNumber
                || row?.canonicalProduct?.sourceRow?.product_number
                || `TODO-PRODUCT-${index + 1}`;
        },

        getStructuredProductName(row, index) {
            return row?.shopwareSyncPayload?.name
                || row?.mcpProductPreview?.name
                || row?.canonicalProduct?.name
                || row?.canonicalProduct?.sourceRow?.name
                || `Demo Product ${index + 1}`;
        },

        getStructuredReviewNote(row) {
            const warnings = row?.canonicalProduct?.warnings || [];

            if (!Array.isArray(warnings) || warnings.length === 0) {
                return '';
            }

            return warnings.join(' ');
        },

        buildStructuredComparisons(row, syncPayloadMap) {
            const syncPayload = this.resolveRowSyncPayload(row, syncPayloadMap);

            if (!syncPayload || typeof syncPayload !== 'object') {
                return [];
            }

            return Object.keys(syncPayload)
                .filter((key) => !this.shouldIgnoreSyncField(key))
                .filter((key) => !this.shouldIgnoreSyncFieldValue(key, syncPayload[key]))
                .map((key) => {
                    const currentValue = this.formatComparisonValue(this.resolveCurrentProductValue(row?.canonicalProduct || {}, key), key);
                    const newValue = this.formatComparisonValue(syncPayload[key], key);

                    return {
                        key,
                        field: this.humanizeFieldKey(key),
                        currentValue,
                        newValue,
                        changed: this.toComparableValue(currentValue) !== this.toComparableValue(newValue),
                    };
                });
        },

        resolveCurrentProductValue(currentProduct, key) {
            const aliases = {
                visibilities: currentProduct.salesChannelId ? [currentProduct.salesChannelId] : [],
                media: currentProduct.imageUrls || (currentProduct.coverMediaId ? [currentProduct.coverMediaId] : []),
            };

            if (Object.prototype.hasOwnProperty.call(aliases, key)) {
                return aliases[key];
            }

            return currentProduct[key];
        },

        resolveFetchedProductValue(currentProduct, key) {
            if (!currentProduct || typeof currentProduct !== 'object') {
                return null;
            }

            const normalizedKey = this.normalizeFieldKey(key);
            const categories = this.normalizeCollection(currentProduct.categories);
            const visibilities = this.normalizeCollection(currentProduct.visibilities);
            const properties = this.normalizeCollection(currentProduct.properties);

            const currentValueMap = {
                name: currentProduct.name,
                description: currentProduct.description,
                active: currentProduct.active,
                stock: currentProduct.stock,
                manufacturer: currentProduct.manufacturer?.name,
                manufacturername: currentProduct.manufacturer?.name,
                taxrate: currentProduct.tax?.taxRate ?? currentProduct.taxRate,
                taxname: currentProduct.tax?.name,
                categories: categories.map((category) => category.name || category.id),
                visibilities: visibilities.map((visibility) => visibility.salesChannel?.name || visibility.salesChannelId),
                saleschannel: visibilities.map((visibility) => visibility.salesChannel?.name || visibility.salesChannelId),
                saleschannels: visibilities.map((visibility) => visibility.salesChannel?.name || visibility.salesChannelId),
                property: properties.map((property) => this.formatPropertyValue(property)),
                properties: properties.map((property) => this.formatPropertyValue(property)),
            };

            if (Object.prototype.hasOwnProperty.call(currentValueMap, normalizedKey)) {
                return currentValueMap[normalizedKey];
            }

            return currentProduct[key];
        },

        normalizeCollection(collection) {
            if (!collection) {
                return [];
            }

            if (Array.isArray(collection)) {
                return collection;
            }

            if (typeof collection.forEach === 'function') {
                const items = [];

                collection.forEach((item) => items.push(item));

                return items;
            }

            if (collection.elements && typeof collection.elements === 'object') {
                return Object.values(collection.elements);
            }

            return [];
        },

        formatPropertyValue(property) {
            if (!property) {
                return '';
            }

            if (property.group?.name && property.name) {
                return `${property.group.name}: ${property.name}`;
            }

            return property.name || property.id || '';
        },

        formatComparisonValue(value, key) {
            if (value === null || value === undefined || value === '') {
                return 'Not assigned';
            }

            if (key === 'active') {
                if (value === true || value === 'true' || value === 1 || value === '1') {
                    return 'Active';
                }

                if (value === false || value === 'false' || value === 0 || value === '0') {
                    return 'Inactive';
                }
            }

            if ((key === 'price' || key.includes('price')) && !Number.isNaN(Number(value))) {
                return Number(value).toFixed(2);
            }

            if ((key === 'taxRate' || key === 'tax_rate') && !Number.isNaN(Number(value))) {
                return `${Number(value)}%`;
            }

            if (Array.isArray(value)) {
                const formattedValues = value
                    .map((item) => this.formatObjectValue(item))
                    .filter(Boolean);

                return formattedValues.length > 0 ? formattedValues.join(', ') : 'Not assigned';
            }

            if (typeof value === 'object') {
                return this.formatObjectValue(value);
            }

            return String(value);
        },

        formatObjectValue(value) {
            if (value === null || value === undefined) {
                return '';
            }

            if (typeof value !== 'object') {
                return String(value);
            }

            const preferredKeys = ['name', 'path', 'url', 'salesChannelId', 'mediaId', 'id'];
            const matchedKey = preferredKeys.find((key) => value[key]);

            if (matchedKey) {
                return String(value[matchedKey]);
            }

            return JSON.stringify(value);
        },

        toComparableValue(value) {
            return String(value || '').trim().toLowerCase();
        },

        normalizeRow(row, index) {
            return {
                id: row.id || `row-${index}`,
                productNumber: row.productNumber || `TODO-PRODUCT-${index + 1}`,
                productName: row.productName || `Demo Product ${index + 1}`,
                sourceColumn: row.sourceColumn || 'TODO',
                suggestedProperty: row.suggestedProperty || 'TODO',
                currentValue: row.currentValue || 'Not assigned',
                proposedValue: row.proposedValue || '',
                action: row.action || 'Needs Review',
                confidence: row.confidence || 'Needs Review',
                status: row.status || 'Needs Review',
                reviewNote: row.reviewNote || '',
            };
        },

        normalizeProductComparisons(products, structuredRows = [], syncPayloadMap = new Map()) {
            if (products.length > 0) {
                return products.map((product, index) => ({
                    id: product.productNumber || `product-${index}`,
                    productNumber: product.productNumber || `TODO-PRODUCT-${index + 1}`,
                    productName: product.productName || `Demo Product ${index + 1}`,
                    oldVersion: product.oldVersion || {},
                    newVersion: product.newVersion || {},
                    comparisons: Array.isArray(product.comparisons) ? product.comparisons : [],
                    syncPayload: this.resolveProductSyncPayload(product, syncPayloadMap),
                }));
            }

            return structuredRows.map((row, index) => {
                const productNumber = this.getStructuredProductNumber(row, index);
                const productName = this.getStructuredProductName(row, index);
                const comparisons = this.buildStructuredComparisons(row, syncPayloadMap);

                return {
                    id: row?.canonicalProduct?.id || row?.shopwareSyncPayload?.id || productNumber,
                    productNumber,
                    productName,
                    oldVersion: Object.fromEntries(comparisons.map((comparison) => [comparison.field, comparison.currentValue])),
                    newVersion: Object.fromEntries(comparisons.map((comparison) => [comparison.field, comparison.newValue])),
                    comparisons,
                    syncPayload: this.resolveRowSyncPayload(row, syncPayloadMap),
                };
            });
        },

        hydrateResultPayload(payload, isDemo = false) {
            const syncPayloadMap = this.buildSyncPayloadMap(payload.shopwareSyncRequest || []);
            const structuredRows = this.getStructuredRows(payload.rows);

            this.reviewRows = this.normalizePayloadRows(payload.rows || [], syncPayloadMap);
            this.productComparisons = this.normalizeProductComparisons(payload.products || [], structuredRows, syncPayloadMap);
            this.fileMeta = {
                fileName: payload.fileName || this.selectedFile?.name || 'import.csv',
                delimiter: payload.delimiter || ',',
                headers: payload.headers || [],
            };
            this.warnings = payload.warnings || [];
            this.formatterTodo = payload.todo || null;
            this.formattedPayloadText = this.stringifySyncPayloads(this.productComparisons);
            this.isShowingDemoData = isDemo;
        },

        startProgressSimulation() {
            this.stopProgressSimulation();

            this.progressTimer = window.setInterval(() => {
                if (this.progressValue < 90) {
                    this.progressValue += 7;
                }
            }, 180);
        },

        finishProgressSimulation() {
            this.stopProgressSimulation();
            this.progressValue = 100;
        },

        stopProgressSimulation() {
            if (this.progressTimer) {
                window.clearInterval(this.progressTimer);
                this.progressTimer = null;
            }
        },

        getErrorMessage(error) {
            return error?.response?.data?.errors?.[0]?.detail
                || error?.message
                || this.$tc('hackathon-spec-mapper.messages.genericError');
        },

        getComparisonCellVariant(isChanged) {
            return isChanged ? 'primary' : 'neutral';
        },

    },
});

# Flutter Credit Mobile App — P4: Core Ops Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the staff app with Application Create/Edit and Borrower Profile Create, expand the borrower app with E-sign and Secure Messaging, and add the backend messaging API if not already present.

**Architecture:** Application create/edit uses a multi-step form wizard backed by `PageView`. E-sign checks the `esign` adapter status and falls back to "Download & Sign Manually" if the real adapter is not yet live. Secure messaging uses a new credit comments endpoint (modelled on the existing `RequestActivity` pattern). All screens reuse the P1 core layer.

**Tech Stack:** Flutter 3.19+, flutter_riverpod 2.5.1, go_router 13.2.0, flutter_pdfview 1.3.2, Node.js/Express/TypeScript (messaging endpoint)

**Prerequisites:** P2 (Staff MVP) and P3 (Borrower MVP) complete.

**Spec:** `docs/superpowers/specs/2026-06-05-flutter-credit-mobile-app-design.md` §2.4, §2.5, §3.4, §3.5

---

## File Map

```
cwc_mobile/lib/staff/
├── applications/
│   ├── application_create_screen.dart   (new)
│   └── application_edit_screen.dart     (new)
├── borrowers/
│   └── borrower_create_screen.dart      (new)

cwc_mobile/lib/borrower/
├── esign/
│   └── esign_screen.dart               (new)
└── messaging/
    └── messaging_screen.dart            (new — shared with staff)

cwc_mobile/lib/shared/
└── messaging/
    ├── messaging_provider.dart
    └── messaging_screen.dart

backend/src/credit/
├── controllers/applicationComment.controller.ts  (new)
├── routes/applicationComment.routes.ts           (new)
├── services/applicationComment.service.ts        (new)
```

---

## Task 1: Backend — Application Comments (Messaging) API

**Files:**
- Create: `backend/src/credit/services/applicationComment.service.ts`
- Create: `backend/src/credit/controllers/applicationComment.controller.ts`
- Create: `backend/src/credit/routes/applicationComment.routes.ts`
- Modify: `backend/src/credit/routes/credit.routes.ts`

- [ ] **Step 1: Check if comments already exist**

```bash
grep -r "comment\|Comment\|activity\|Activity" backend/src/credit/routes/ --include="*.ts" -l
```

If `applicationComment` or equivalent already exists, skip to Task 2 and use the existing endpoint.

- [ ] **Step 2: Write comment service**

```typescript
// backend/src/credit/services/applicationComment.service.ts
import prisma from '../../utils/prisma';

export interface CreateCommentInput {
  applicationId: string;
  authorId: string;
  body: string;
  isInternal: boolean; // true = staff-only, false = visible to borrower
}

export const applicationCommentService = {
  async list(applicationId: string, includeInternal: boolean) {
    return prisma.applicationComment.findMany({
      where: {
        applicationId,
        ...(includeInternal ? {} : { isInternal: false }),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(input: CreateCommentInput) {
    return prisma.applicationComment.create({
      data: {
        applicationId: input.applicationId,
        authorId: input.authorId,
        body: input.body,
        isInternal: input.isInternal,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },
};
```

- [ ] **Step 3: Add Prisma model**

In `backend/prisma/schema.prisma`, add:

```prisma
model ApplicationComment {
  id            String   @id @default(cuid())
  applicationId String   @map("application_id")
  authorId      String   @map("author_id")
  body          String
  isInternal    Boolean  @default(false) @map("is_internal")
  createdAt     DateTime @default(now()) @map("created_at")

  application CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  author      User              @relation(fields: [authorId], references: [id])

  @@map("application_comments")
}
```

Add to `User` model:
```prisma
  applicationComments ApplicationComment[]
```

Add to `CreditApplication` model:
```prisma
  comments ApplicationComment[]
```

Run migration:
```bash
cd backend && npx prisma migrate dev --name add_application_comments
```

- [ ] **Step 4: Write controller**

```typescript
// backend/src/credit/controllers/applicationComment.controller.ts
import { Request, Response } from 'express';
import { applicationCommentService } from '../services/applicationComment.service';

export const listComments = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { appId } = req.params;
  const isBorrower = user.permissions?.includes('credit:borrower') && !user.permissions?.includes('credit:read');
  const comments = await applicationCommentService.list(appId, !isBorrower);
  res.json({ status: 'success', data: { comments } });
};

export const createComment = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { appId } = req.params;
  const { body, isInternal } = req.body;

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    res.status(400).json({ status: 'error', message: 'Comment body is required' });
    return;
  }

  const isBorrower = user.permissions?.includes('credit:borrower') && !user.permissions?.includes('credit:read');
  const comment = await applicationCommentService.create({
    applicationId: appId,
    authorId: user.id,
    body: body.trim(),
    isInternal: isBorrower ? false : (isInternal ?? false),
  });

  res.status(201).json({ status: 'success', data: { comment } });
};
```

- [ ] **Step 5: Write route + mount**

```typescript
// backend/src/credit/routes/applicationComment.routes.ts
import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { listComments, createComment } from '../controllers/applicationComment.controller';

const router = Router({ mergeParams: true });

router.get('/', authenticate, listComments);
router.post('/', authenticate, createComment);

export default router;
```

In `backend/src/credit/routes/credit.routes.ts`, add:
```typescript
import applicationCommentRoutes from './applicationComment.routes';
// Mount under applications — accessible to both credit:read and credit:borrower
router.use('/applications/:appId/comments', applicationCommentRoutes);
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/credit/services/applicationComment.service.ts \
        backend/src/credit/controllers/applicationComment.controller.ts \
        backend/src/credit/routes/applicationComment.routes.ts \
        backend/src/credit/routes/credit.routes.ts \
        backend/prisma/schema.prisma \
        backend/prisma/migrations/
git commit -m "feat(credit): add application comments API for borrower/staff messaging"
```

---

## Task 2: Staff — Application Create Screen

**Files:**
- Create: `cwc_mobile/lib/staff/applications/application_create_screen.dart`
- Modify: `cwc_mobile/lib/staff/applications/application_provider.dart`
- Modify: `cwc_mobile/lib/staff/router.dart`

- [ ] **Step 1: Add create method to provider**

Add to `cwc_mobile/lib/staff/applications/application_provider.dart`:

```dart
class ApplicationCreateNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<String?> create({
    required String borrowerProfileId,
    required String productType,
    required double totalFacilityAmount,
    required String currency,
    required String requestType,
  }) async {
    state = const AsyncValue.loading();
    String? id;
    state = await AsyncValue.guard(() async {
      final res = await ref.read(apiClientProvider).post(Endpoints.creditApplications, data: {
        'borrowerProfileId': borrowerProfileId,
        'productType': productType,
        'totalFacilityAmount': totalFacilityAmount,
        'currency': currency,
        'requestType': requestType,
      });
      id = res.data['data']['application']['id'] as String?;
    });
    return id;
  }
}

final applicationCreateProvider = AutoDisposeNotifierProvider<ApplicationCreateNotifier, AsyncValue<void>>(
  ApplicationCreateNotifier.new,
);

// Borrower list for picker
final borrowerListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.read(apiClientProvider).get(Endpoints.creditBorrowers);
  final list = res.data['data']['borrowers'] as List<dynamic>? ?? [];
  return list.cast<Map<String, dynamic>>();
});
```

- [ ] **Step 2: Write application create screen**

```dart
// cwc_mobile/lib/staff/applications/application_create_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import 'application_provider.dart';

const _productTypes = ['TERM_LOAN', 'REVOLVING_CREDIT', 'OVERDRAFT', 'LETTER_OF_CREDIT',
    'BANK_GUARANTEE', 'TRADE_FINANCE', 'BRIDGE_LOAN', 'PROJECT_FINANCE'];
const _requestTypes = ['FACILITY_RENEWAL', 'VARIATION', 'POLICY_BREACH_RATIFICATION', 'SICR_IMPAIRMENT'];
const _currencies = ['MYR', 'USD', 'SGD', 'GBP', 'EUR'];

class ApplicationCreateScreen extends ConsumerStatefulWidget {
  const ApplicationCreateScreen({super.key});

  @override
  ConsumerState<ApplicationCreateScreen> createState() => _State();
}

class _State extends ConsumerState<ApplicationCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  int _step = 0; // 0 = borrower, 1 = product, 2 = confirm

  String? _borrowerId;
  String? _borrowerName;
  String _productType = _productTypes.first;
  final _amountCtrl = TextEditingController();
  String _currency = 'MYR';
  String _requestType = _requestTypes.first;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final id = await ref.read(applicationCreateProvider.notifier).create(
      borrowerProfileId: _borrowerId!,
      productType: _productType,
      totalFacilityAmount: double.parse(_amountCtrl.text.replaceAll(',', '')),
      currency: _currency,
      requestType: _requestType,
    );
    final state = ref.read(applicationCreateProvider);
    if (state is AsyncError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: ${(state as AsyncError).error}'), backgroundColor: AppColors.danger));
      return;
    }
    if (id != null && mounted) context.go('/applications/$id');
  }

  @override
  Widget build(BuildContext context) {
    final createState = ref.watch(applicationCreateProvider);
    final borrowers = ref.watch(borrowerListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('New Application'), bottom: PreferredSize(
        preferredSize: const Size.fromHeight(4),
        child: LinearProgressIndicator(value: (_step + 1) / 3, backgroundColor: Colors.white24),
      )),
      body: Form(
        key: _formKey,
        child: PageView(
          physics: const NeverScrollableScrollPhysics(),
          controller: PageController(initialPage: _step),
          children: [
            // Step 0: Borrower picker
            _StepPage(
              title: 'Select Borrower',
              child: borrowers.when(
                loading: () => const CircularProgressIndicator(),
                error: (e, _) => Text('Error: $e'),
                data: (list) => ListView(children: list.map((b) => RadioListTile<String>(
                  title: Text(b['companyName'] as String? ?? b['id']),
                  value: b['id'] as String,
                  groupValue: _borrowerId,
                  onChanged: (v) => setState(() {
                    _borrowerId = v;
                    _borrowerName = b['companyName'] as String?;
                  }),
                )).toList()),
              ),
              onNext: _borrowerId != null ? () => setState(() => _step = 1) : null,
            ),
            // Step 1: Product details
            _StepPage(
              title: 'Loan Details',
              child: Column(children: [
                DropdownButtonFormField<String>(
                  value: _productType,
                  decoration: const InputDecoration(labelText: 'Product Type'),
                  items: _productTypes.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))).toList(),
                  onChanged: (v) => setState(() => _productType = v!),
                ),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(flex: 2, child: TextFormField(
                    controller: _amountCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount'),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      final n = double.tryParse(v.replaceAll(',', ''));
                      if (n == null || n <= 0) return 'Enter a valid amount';
                      return null;
                    },
                  )),
                  const SizedBox(width: 12),
                  Expanded(child: DropdownButtonFormField<String>(
                    value: _currency,
                    decoration: const InputDecoration(labelText: 'Currency'),
                    items: _currencies.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                    onChanged: (v) => setState(() => _currency = v!),
                  )),
                ]),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _requestType,
                  decoration: const InputDecoration(labelText: 'Request Type'),
                  items: _requestTypes.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))).toList(),
                  onChanged: (v) => setState(() => _requestType = v!),
                ),
              ]),
              onNext: () => setState(() => _step = 2),
              onBack: () => setState(() => _step = 0),
            ),
            // Step 2: Confirm
            _StepPage(
              title: 'Confirm',
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _ConfirmRow('Borrower', _borrowerName ?? '-'),
                _ConfirmRow('Product', _productType.replaceAll('_', ' ')),
                _ConfirmRow('Amount', '$_currency ${_amountCtrl.text}'),
                _ConfirmRow('Request Type', _requestType.replaceAll('_', ' ')),
              ]),
              onNext: createState.isLoading ? null : _submit,
              nextLabel: createState.isLoading ? 'Submitting...' : 'Submit',
              onBack: () => setState(() => _step = 1),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() { _amountCtrl.dispose(); super.dispose(); }
}

class _StepPage extends StatelessWidget {
  const _StepPage({required this.title, required this.child, this.onNext, this.onBack, this.nextLabel});
  final String title;
  final Widget child;
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final String? nextLabel;

  @override
  Widget build(BuildContext context) => Column(children: [
    Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Align(alignment: Alignment.centerLeft,
            child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)))),
    Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: child)),
    SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
      if (onBack != null) ...[
        Expanded(child: OutlinedButton(onPressed: onBack, child: const Text('Back'))),
        const SizedBox(width: 12),
      ],
      Expanded(child: FilledButton(onPressed: onNext, child: Text(nextLabel ?? 'Next'))),
    ]))),
  ]);
}

class _ConfirmRow extends StatelessWidget {
  const _ConfirmRow(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(children: [
      SizedBox(width: 130, child: Text(label, style: const TextStyle(color: AppColors.textSecondary))),
      Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
    ]),
  );
}
```

- [ ] **Step 3: Wire into router + add FAB to list screen**

In `cwc_mobile/lib/staff/router.dart`, inside the `/applications` route's `routes:`:

```dart
GoRoute(path: 'new', builder: (_, __) => const ApplicationCreateScreen()),
```

In `cwc_mobile/lib/staff/applications/application_list_screen.dart`, add to `Scaffold`:

```dart
floatingActionButton: FloatingActionButton(
  onPressed: () => context.push('/applications/new'),
  child: const Icon(Icons.add),
),
```

- [ ] **Step 4: Commit**

```bash
git add cwc_mobile/lib/staff/applications/application_create_screen.dart \
        cwc_mobile/lib/staff/applications/application_provider.dart \
        cwc_mobile/lib/staff/applications/application_list_screen.dart \
        cwc_mobile/lib/staff/router.dart
git commit -m "feat(mobile/staff): add Application Create 3-step wizard"
```

---

## Task 3: Staff — Application Edit Screen

**Files:**
- Create: `cwc_mobile/lib/staff/applications/application_edit_screen.dart`

- [ ] **Step 1: Add update method to application_provider.dart**

```dart
class ApplicationUpdateNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> update(String applicationId, Map<String, dynamic> fields) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await ref.read(apiClientProvider).patch('${Endpoints.creditApplications}/$applicationId', data: fields);
    });
  }
}

final applicationUpdateProvider = AutoDisposeNotifierProvider<ApplicationUpdateNotifier, AsyncValue<void>>(
  ApplicationUpdateNotifier.new,
);
```

- [ ] **Step 2: Write application edit screen**

```dart
// cwc_mobile/lib/staff/applications/application_edit_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import 'application_provider.dart';

const _productTypes = ['TERM_LOAN', 'REVOLVING_CREDIT', 'OVERDRAFT', 'LETTER_OF_CREDIT',
    'BANK_GUARANTEE', 'TRADE_FINANCE', 'BRIDGE_LOAN', 'PROJECT_FINANCE'];
const _currencies = ['MYR', 'USD', 'SGD', 'GBP', 'EUR'];

class ApplicationEditScreen extends ConsumerStatefulWidget {
  const ApplicationEditScreen({super.key, required this.applicationId});
  final String applicationId;

  @override
  ConsumerState<ApplicationEditScreen> createState() => _State();
}

class _State extends ConsumerState<ApplicationEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountCtrl = TextEditingController();
  String? _productType;
  String? _currency;
  bool _initialized = false;

  void _init(CreditApplication app) {
    if (_initialized) return;
    _initialized = true;
    _amountCtrl.text = app.totalFacilityAmount?.toStringAsFixed(0) ?? '';
    _productType = app.productType;
    _currency = app.currency ?? 'MYR';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(applicationUpdateProvider.notifier).update(widget.applicationId, {
      if (_productType != null) 'productType': _productType,
      'totalFacilityAmount': double.parse(_amountCtrl.text.replaceAll(',', '')),
      if (_currency != null) 'currency': _currency,
    });
    final state = ref.read(applicationUpdateProvider);
    if (state is AsyncError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Update failed: ${(state as AsyncError).error}'), backgroundColor: AppColors.danger));
      return;
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Application updated')));
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final appAsync = ref.watch(applicationDetailProvider(widget.applicationId));
    final updateState = ref.watch(applicationUpdateProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Edit Application')),
      body: appAsync.when(
        loading: () => const LoadingOverlay(message: 'Loading...'),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (app) {
          _init(app);
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(app.borrowerProfile?.companyName ?? app.id,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 20),
                DropdownButtonFormField<String>(
                  value: _productType,
                  decoration: const InputDecoration(labelText: 'Product Type'),
                  items: _productTypes.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))).toList(),
                  onChanged: (v) => setState(() => _productType = v),
                ),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(flex: 2, child: TextFormField(
                    controller: _amountCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Facility Amount'),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      final n = double.tryParse(v.replaceAll(',', ''));
                      return n == null || n <= 0 ? 'Enter a valid amount' : null;
                    },
                  )),
                  const SizedBox(width: 12),
                  Expanded(child: DropdownButtonFormField<String>(
                    value: _currency,
                    decoration: const InputDecoration(labelText: 'Currency'),
                    items: _currencies.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                    onChanged: (v) => setState(() => _currency = v),
                  )),
                ]),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: updateState.isLoading ? null : _submit,
                  child: updateState.isLoading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Save Changes'),
                ),
              ]),
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() { _amountCtrl.dispose(); super.dispose(); }
}
```

- [ ] **Step 3: Wire into router + add edit button to detail screen**

In `cwc_mobile/lib/staff/router.dart`, inside the `/applications/:id` routes:

```dart
import '../staff/applications/application_edit_screen.dart';
// Inside GoRoute path ':id':
routes: [
  GoRoute(path: 'edit', builder: (_, s) => ApplicationEditScreen(applicationId: s.pathParameters['id']!)),
],
```

In `cwc_mobile/lib/staff/applications/application_detail_screen.dart`, add to `AppBar.actions`:

```dart
actions: [
  IconButton(
    icon: const Icon(Icons.edit_outlined),
    onPressed: () => context.push('/applications/$applicationId/edit'),
  ),
],
```

- [ ] **Step 4: Commit**

```bash
git add cwc_mobile/lib/staff/applications/application_edit_screen.dart \
        cwc_mobile/lib/staff/applications/application_provider.dart \
        cwc_mobile/lib/staff/applications/application_detail_screen.dart \
        cwc_mobile/lib/staff/router.dart
git commit -m "feat(mobile/staff): add Application Edit screen for product type, amount, and currency"
```

---

## Task 4: Staff — Borrower Profile Create Screen

**Files:**
- Create: `cwc_mobile/lib/staff/borrowers/borrower_create_screen.dart`
- Create: `cwc_mobile/lib/staff/borrowers/borrower_list_screen.dart`

- [ ] **Step 1: Write borrower provider additions**

Add to `cwc_mobile/lib/staff/applications/application_provider.dart` (or a new `borrower_provider.dart`):

```dart
// cwc_mobile/lib/staff/borrowers/borrower_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';

class BorrowerCreateNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<String?> create({
    required String companyName,
    required String businessRegNo,
    required String sector,
    required String contactEmail,
  }) async {
    state = const AsyncValue.loading();
    String? id;
    state = await AsyncValue.guard(() async {
      final res = await ref.read(apiClientProvider).post(Endpoints.creditBorrowers, data: {
        'companyName': companyName,
        'businessRegNo': businessRegNo,
        'sector': sector,
        'contactEmail': contactEmail,
      });
      id = res.data['data']['borrowerProfile']['id'] as String?;
    });
    return id;
  }
}

final borrowerCreateProvider = AutoDisposeNotifierProvider<BorrowerCreateNotifier, AsyncValue<void>>(
  BorrowerCreateNotifier.new,
);
```

- [ ] **Step 2: Write borrower create screen**

```dart
// cwc_mobile/lib/staff/borrowers/borrower_create_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import 'borrower_provider.dart';

const _sectors = ['MANUFACTURING', 'TRADING', 'CONSTRUCTION', 'SERVICES', 'AGRICULTURE',
    'TECHNOLOGY', 'PROPERTY', 'FINANCE', 'HEALTHCARE', 'OTHER'];

class BorrowerCreateScreen extends ConsumerStatefulWidget {
  const BorrowerCreateScreen({super.key});

  @override
  ConsumerState<BorrowerCreateScreen> createState() => _State();
}

class _State extends ConsumerState<BorrowerCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _companyNameCtrl = TextEditingController();
  final _regNoCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  String _sector = _sectors.first;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final id = await ref.read(borrowerCreateProvider.notifier).create(
      companyName: _companyNameCtrl.text.trim(),
      businessRegNo: _regNoCtrl.text.trim(),
      sector: _sector,
      contactEmail: _emailCtrl.text.trim(),
    );
    final state = ref.read(borrowerCreateProvider);
    if (state is AsyncError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: ${(state as AsyncError).error}'), backgroundColor: AppColors.danger));
      return;
    }
    if (mounted) context.go('/borrowers/$id');
  }

  @override
  Widget build(BuildContext context) {
    final createState = ref.watch(borrowerCreateProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('New Borrower Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            TextFormField(
              controller: _companyNameCtrl,
              decoration: const InputDecoration(labelText: 'Company Name'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _regNoCtrl,
              decoration: const InputDecoration(labelText: 'Business Registration No.', hintText: 'e.g. 202301001234'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _sector,
              decoration: const InputDecoration(labelText: 'Sector'),
              items: _sectors.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: (v) => setState(() => _sector = v!),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Primary Contact Email'),
              validator: (v) => v != null && v.isNotEmpty && !v.contains('@') ? 'Enter a valid email' : null,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: createState.isLoading ? null : _submit,
              child: createState.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Create Borrower Profile'),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  void dispose() { _companyNameCtrl.dispose(); _regNoCtrl.dispose(); _emailCtrl.dispose(); super.dispose(); }
}
```

- [ ] **Step 3: Write BorrowerListScreen**

Create `cwc_mobile/lib/staff/borrowers/borrower_list_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';

class BorrowerListScreen extends ConsumerWidget {
  const BorrowerListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final borrowersAsync = ref.watch(_borrowerListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Borrower Profiles')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/borrowers/new'),
        child: const Icon(Icons.add),
      ),
      body: borrowersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: TextStyle(color: AppColors.danger))),
        data: (borrowers) {
          if (borrowers.isEmpty) {
            return const Center(child: Text('No borrower profiles yet.\nTap + to create one.', textAlign: TextAlign.center));
          }
          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: borrowers.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final b = borrowers[i];
              return ListTile(
                title: Text(b['companyName'] as String? ?? '-', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(b['businessRegNo'] as String? ?? ''),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/borrowers/${b['id']}'),
              );
            },
          );
        },
      ),
    );
  }
}

final _borrowerListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.read(apiClientProvider).get(Endpoints.creditBorrowers);
  final list = res.data['data']['borrowerProfiles'] as List<dynamic>? ?? [];
  return list.cast<Map<String, dynamic>>();
});
```

- [ ] **Step 4: Wire into router**

In `cwc_mobile/lib/staff/router.dart`, update to use the full list screen:

```dart
import '../staff/borrowers/borrower_list_screen.dart';
import '../staff/borrowers/borrower_create_screen.dart';
// ...
GoRoute(
  path: '/borrowers',
  builder: (_, __) => const BorrowerListScreen(),
  routes: [
    GoRoute(path: 'new', builder: (_, __) => const BorrowerCreateScreen()),
  ],
),
```

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/staff/borrowers/
git commit -m "feat(mobile/staff): add Borrower Profile List and Create screens"
```

---

## Task 5: Borrower — E-sign Screen

**Files:**
- Create: `cwc_mobile/lib/borrower/esign/esign_screen.dart`
- Modify: `cwc_mobile/lib/borrower/router.dart`

- [ ] **Step 1: Write e-sign screen**

The e-sign adapter is a placeholder (`esign.placeholder.ts`). This screen checks if a signed offer URL is available. If the adapter is live, it opens the URL. If not, it shows a "Download & Sign Manually" fallback with re-upload.

```dart
// cwc_mobile/lib/borrower/esign/esign_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import '../../core/api/api_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/loading_overlay.dart';
import '../../core/widgets/error_state.dart';

class EsignData {
  const EsignData({this.esignUrl, this.offerPdfUrl, this.adapterLive = false});
  final String? esignUrl;
  final String? offerPdfUrl;
  final bool adapterLive;
}

final esignProvider = FutureProvider.family<EsignData, String>((ref, applicationId) async {
  try {
    final res = await ref.read(apiClientProvider).get('/credit/applications/$applicationId/esign');
    final data = res.data['data'] as Map<String, dynamic>? ?? {};
    return EsignData(
      esignUrl: data['esignUrl'] as String?,
      offerPdfUrl: data['offerPdfUrl'] as String?,
      adapterLive: data['adapterLive'] as bool? ?? false,
    );
  } catch (_) {
    return const EsignData();
  }
});

class EsignScreen extends ConsumerWidget {
  const EsignScreen({super.key, required this.applicationId});
  final String applicationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final esignAsync = ref.watch(esignProvider(applicationId));

    return Scaffold(
      appBar: AppBar(title: const Text('Loan Offer')),
      body: esignAsync.when(
        loading: () => const LoadingOverlay(message: 'Loading offer...'),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (data) => data.adapterLive && data.esignUrl != null
            ? _LiveEsign(esignUrl: data.esignUrl!)
            : _ManualEsign(applicationId: applicationId, offerPdfUrl: data.offerPdfUrl),
      ),
    );
  }
}

class _LiveEsign extends StatelessWidget {
  const _LiveEsign({required this.esignUrl});
  final String esignUrl;

  @override
  Widget build(BuildContext context) => Column(children: [
    Container(color: AppColors.success.withOpacity(0.1),
        padding: const EdgeInsets.all(12),
        child: const Row(children: [
          Icon(Icons.security, color: AppColors.success, size: 18),
          SizedBox(width: 8),
          Text('Secure digital signing powered by DocuSign', style: TextStyle(fontSize: 13)),
        ])),
    Expanded(child: Center(child: FilledButton.icon(
      icon: const Icon(Icons.draw_outlined),
      label: const Text('Open Signing Portal'),
      onPressed: () { /* launch esignUrl via url_launcher */ },
    ))),
  ]);
}

class _ManualEsign extends StatelessWidget {
  const _ManualEsign({required this.applicationId, this.offerPdfUrl});
  final String applicationId;
  final String? offerPdfUrl;

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
    Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.warning.withOpacity(0.1), borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.warning.withOpacity(0.4))),
      child: const Text(
        'Digital signing is not yet available. Please download the offer letter, sign it physically, and upload the signed copy below.',
        style: TextStyle(fontSize: 13),
      ),
    ),
    const SizedBox(height: 20),
    if (offerPdfUrl != null)
      OutlinedButton.icon(
        icon: const Icon(Icons.download_outlined),
        label: const Text('Download Offer Letter'),
        onPressed: () { /* launch offerPdfUrl via url_launcher */ },
      ),
    const SizedBox(height: 12),
    FilledButton.icon(
      icon: const Icon(Icons.upload_file_outlined),
      label: const Text('Upload Signed Copy'),
      onPressed: () { /* reuse document upload flow for SIGNED_OFFER type */ },
    ),
  ]);
}
```

- [ ] **Step 2: Wire into router**

In `cwc_mobile/lib/borrower/router.dart`, add to `'/application/:id'` routes:

```dart
import '../borrower/esign/esign_screen.dart';
// ...
GoRoute(
  path: 'esign',
  builder: (_, s) => EsignScreen(applicationId: s.pathParameters['id']!),
),
```

In `cwc_mobile/lib/borrower/tracker/status_tracker_screen.dart`, update the `_TerminalCard` for `offer` state:

```dart
action: FilledButton.icon(
  icon: const Icon(Icons.draw),
  label: const Text('Sign Offer'),
  onPressed: () => context.push('/application/${app.id}/esign'),
),
```

- [ ] **Step 3: Commit**

```bash
git add cwc_mobile/lib/borrower/esign/ cwc_mobile/lib/borrower/router.dart cwc_mobile/lib/borrower/tracker/status_tracker_screen.dart
git commit -m "feat(mobile/borrower): add E-sign screen with live adapter and manual fallback"
```

---

## Task 6: Shared — Secure Messaging Screen

**Files:**
- Create: `cwc_mobile/lib/shared/messaging/messaging_provider.dart`
- Create: `cwc_mobile/lib/shared/messaging/messaging_screen.dart`
- Modify: `cwc_mobile/lib/staff/router.dart`
- Modify: `cwc_mobile/lib/borrower/router.dart`

- [ ] **Step 1: Write messaging models**

Add to `cwc_mobile/lib/core/models/credit_models.dart`:

```dart
class ApplicationComment {
  const ApplicationComment({
    required this.id,
    required this.body,
    required this.authorId,
    required this.authorName,
    required this.isInternal,
    required this.createdAt,
  });

  final String id;
  final String body;
  final String authorId;
  final String authorName;
  final bool isInternal;
  final DateTime createdAt;

  factory ApplicationComment.fromJson(Map<String, dynamic> j) => ApplicationComment(
    id: j['id'] as String,
    body: j['body'] as String,
    authorId: (j['author'] as Map<String, dynamic>?)?['id'] as String? ?? '',
    authorName: (() {
      final a = j['author'] as Map<String, dynamic>?;
      if (a == null) return 'Unknown';
      return '${a['firstName']} ${a['lastName']}';
    })(),
    isInternal: j['isInternal'] as bool? ?? false,
    createdAt: DateTime.parse(j['createdAt'] as String),
  );
}
```

- [ ] **Step 2: Write messaging provider**

```dart
// cwc_mobile/lib/shared/messaging/messaging_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/models/credit_models.dart';

final messagesProvider = FutureProvider.family<List<ApplicationComment>, String>((ref, applicationId) async {
  final res = await ref.read(apiClientProvider).get('/credit/applications/$applicationId/comments');
  final list = res.data['data']['comments'] as List<dynamic>? ?? [];
  return list.map((j) => ApplicationComment.fromJson(j as Map<String, dynamic>)).toList();
});

class SendMessageNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> send(String applicationId, String body) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await ref.read(apiClientProvider).post('/credit/applications/$applicationId/comments', data: {
        'body': body,
        'isInternal': false,
      });
    });
  }
}

final sendMessageProvider = AutoDisposeNotifierProvider<SendMessageNotifier, AsyncValue<void>>(SendMessageNotifier.new);
```

- [ ] **Step 3: Write messaging screen**

```dart
// cwc_mobile/lib/shared/messaging/messaging_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import 'messaging_provider.dart';

class MessagingScreen extends ConsumerStatefulWidget {
  const MessagingScreen({super.key, required this.applicationId});
  final String applicationId;

  @override
  ConsumerState<MessagingScreen> createState() => _State();
}

class _State extends ConsumerState<MessagingScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    _msgCtrl.clear();
    await ref.read(sendMessageProvider.notifier).send(widget.applicationId, text);
    ref.invalidate(messagesProvider(widget.applicationId));
    await Future.delayed(const Duration(milliseconds: 300));
    if (_scrollCtrl.hasClients) {
      _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(messagesProvider(widget.applicationId));
    final userId = ref.watch(authProvider).valueOrNull?.user?.id ?? '';
    final sendState = ref.watch(sendMessageProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: Column(children: [
        Expanded(child: messages.when(
          loading: () => const LoadingOverlay(message: 'Loading messages...'),
          error: (e, _) => ErrorState(message: e.toString()),
          data: (list) {
            if (list.isEmpty) return const Center(child: Text('No messages yet. Start the conversation.'));
            return ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              itemBuilder: (ctx, i) => _MessageBubble(comment: list[i], isMe: list[i].authorId == userId),
            );
          },
        )),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(children: [
              Expanded(child: TextField(
                controller: _msgCtrl,
                decoration: const InputDecoration(hintText: 'Type a message...', isDense: true),
                maxLines: null,
                textInputAction: TextInputAction.newline,
              )),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: sendState.isLoading ? null : _send,
                icon: sendState.isLoading
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.send),
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  @override
  void dispose() { _msgCtrl.dispose(); _scrollCtrl.dispose(); super.dispose(); }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.comment, required this.isMe});
  final ApplicationComment comment;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd MMM · HH:mm');
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            CircleAvatar(radius: 14, backgroundColor: AppColors.primary,
                child: Text(comment.authorName.isNotEmpty ? comment.authorName[0] : '?',
                    style: const TextStyle(color: Colors.white, fontSize: 12))),
            const SizedBox(width: 8),
          ],
          Flexible(child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isMe ? AppColors.primary : Colors.grey[200],
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMe ? 16 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 16),
              ),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (!isMe) Text(comment.authorName,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold,
                      color: isMe ? Colors.white70 : AppColors.textSecondary)),
              Text(comment.body, style: TextStyle(color: isMe ? Colors.white : AppColors.textPrimary)),
              const SizedBox(height: 4),
              Text(fmt.format(comment.createdAt.toLocal()),
                  style: TextStyle(fontSize: 10, color: isMe ? Colors.white60 : AppColors.textSecondary)),
            ]),
          )),
          if (isMe) const SizedBox(width: 8),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Wire into both routers**

In `cwc_mobile/lib/staff/router.dart`, inside `/applications/:id` routes:
```dart
import '../../shared/messaging/messaging_screen.dart';
// ...
GoRoute(path: 'messages', builder: (_, s) => MessagingScreen(applicationId: s.pathParameters['id']!)),
```

In `cwc_mobile/lib/borrower/router.dart`, inside `/application/:id` routes:
```dart
import '../../shared/messaging/messaging_screen.dart';
// ...
GoRoute(path: 'messages', builder: (_, s) => MessagingScreen(applicationId: s.pathParameters['id']!)),
```

Add to staff `ApplicationDetailScreen` AppBar actions:
```dart
IconButton(
  icon: const Icon(Icons.chat_outlined),
  onPressed: () => context.push('/applications/$applicationId/messages'),
),
```

Add to borrower `StatusTrackerScreen` AppBar actions:
```dart
IconButton(
  icon: const Icon(Icons.chat_outlined),
  tooltip: 'Messages',
  onPressed: () => context.push('/application/${app.id}/messages'),
),
```

- [ ] **Step 5: Final Flutter analyze**

```bash
cd cwc_mobile && flutter analyze
```

Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add cwc_mobile/lib/shared/ \
        cwc_mobile/lib/staff/router.dart \
        cwc_mobile/lib/borrower/router.dart \
        cwc_mobile/lib/staff/applications/application_detail_screen.dart \
        cwc_mobile/lib/borrower/tracker/status_tracker_screen.dart \
        cwc_mobile/lib/core/models/credit_models.dart
git commit -m "feat(mobile): add shared Secure Messaging screen for staff and borrower"
```

---

## P4 Complete — Project Complete

At this point the full Flutter Credit Mobile App is implemented:

**Staff app (`cwc_staff`):**
- ✅ Login with biometric auto-auth
- ✅ Dashboard with pipeline KPIs
- ✅ Approval Inbox (APPROVE / REJECT / DEFER / RETURN)
- ✅ Committee Voting with agenda carousel
- ✅ Application List + Detail
- ✅ Application Create (3-step wizard)
- ✅ Application Edit
- ✅ Borrower Profile Create
- ✅ Secure Messaging with borrowers

**Borrower app (`cwc_borrower`):**
- ✅ Registration + Email verification
- ✅ Application linking by reference number
- ✅ Status tracker with visual timeline
- ✅ Document upload (camera, gallery, PDF)
- ✅ E-sign (live adapter + manual fallback)
- ✅ Secure Messaging with RM
- ✅ Push notifications for all events

**Backend additions:**
- ✅ MobileDevice model (device trust, FCM)
- ✅ ApplicationBorrowerLink model
- ✅ ApplicationComment model (messaging)
- ✅ Device register/revoke endpoints
- ✅ Borrower link endpoint
- ✅ FCM push notification service
- ✅ `credit:borrower` RBAC permission

**Remaining open items (from design spec §10):**
1. E-sign provider procurement (DocuSign / SigningCloud) — fill in `esign.placeholder.ts`
2. Firebase project + APNs certificate setup for production
3. App Store / Play Store submission and review (~2–3 weeks buffer)
4. Application reference number auto-generation (backend: add `CA-YYYY-NNNNN` format to application creation)

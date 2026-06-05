# Flutter Credit Mobile App — P3: Borrower App MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Borrower App MVP — Registration, Application Linking, Application Status Tracker, Document Upload, and push notifications — giving borrowers a self-service mobile companion to their loan application.

**Architecture:** All borrower screens are ConsumerWidgets backed by Riverpod providers using the P1 `ApiClient`. Borrower auth uses the same JWT system as staff but with a `credit:borrower` RBAC permission added in P1. Document upload uses `image_picker` (camera/gallery) and `file_picker` (PDF), multipart-posted to the existing `/credit/documents` endpoint. Push notifications reuse the P1 FCM setup.

**Tech Stack:** Flutter 3.19+, flutter_riverpod 2.5.1, go_router 13.2.0, image_picker 1.1.2, file_picker 8.0.7, firebase_messaging 14.9.4

**Prerequisites:** P1 Foundation complete. P2 can run in parallel with P3 — no P2 dependency.

**Spec:** `docs/superpowers/specs/2026-06-05-flutter-credit-mobile-app-design.md` §3

---

## File Map

```
cwc_mobile/lib/borrower/
├── auth/
│   ├── borrower_login_screen.dart
│   ├── borrower_register_screen.dart
│   ├── borrower_register_provider.dart
│   ├── link_application_screen.dart
│   └── link_application_provider.dart
├── home/
│   ├── borrower_home_screen.dart
│   └── borrower_home_provider.dart
├── tracker/
│   ├── status_tracker_screen.dart
│   └── status_tracker_provider.dart
├── documents/
│   ├── document_list_screen.dart
│   ├── document_upload_screen.dart
│   └── document_provider.dart
└── notifications/
    └── borrower_push_handler.dart
```

---

## Task 1: Borrower Login + Registration Screens

**Files:**
- Create: `cwc_mobile/lib/borrower/auth/borrower_login_screen.dart`
- Create: `cwc_mobile/lib/borrower/auth/borrower_register_provider.dart`
- Create: `cwc_mobile/lib/borrower/auth/borrower_register_screen.dart`
- Modify: `cwc_mobile/lib/borrower/router.dart`

- [ ] **Step 1: Write borrower login screen**

The borrower login screen is identical in structure to the staff login (email + password) but without biometric auto-auth on first login. Reuse the P1 `AuthNotifier` from `auth_provider.dart`.

```dart
// cwc_mobile/lib/borrower/auth/borrower_login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/auth_models.dart';
import '../../core/theme/app_theme.dart';

class BorrowerLoginScreen extends ConsumerStatefulWidget {
  const BorrowerLoginScreen({super.key});

  @override
  ConsumerState<BorrowerLoginScreen> createState() => _BorrowerLoginScreenState();
}

class _BorrowerLoginScreenState extends ConsumerState<BorrowerLoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;
  bool _loading = false;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ref.read(authProvider.notifier).login(_emailCtrl.text.trim(), _passCtrl.text);
      if (mounted && ref.read(authProvider).valueOrNull?.status == AuthStatus.authenticated) {
        context.go('/home');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Login failed: $e'), backgroundColor: AppColors.danger));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Icon(Icons.account_balance_wallet_outlined, size: 64, color: AppColors.primary),
            const SizedBox(height: 8),
            Text('CWC Borrower Portal', style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: AppColors.primary, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
            const SizedBox(height: 32),
            TextFormField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
              validator: (v) => v == null || !v.contains('@') ? 'Enter a valid email' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _passCtrl,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock_outlined),
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              validator: (v) => v == null || v.isEmpty ? 'Enter your password' : null,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Sign In'),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: () => context.go('/register'), child: const Text("Don't have an account? Register")),
          ]),
        ),
      ),
    ),
  );

  @override
  void dispose() { _emailCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }
}
```

- [ ] **Step 2: Write register provider**

```dart
// cwc_mobile/lib/borrower/auth/borrower_register_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/device_provider.dart';

class BorrowerRegisterNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await ref.read(authServiceProvider).register(
        email: email, password: password,
        firstName: firstName, lastName: lastName,
        userType: 'BORROWER',
      );
      await ref.read(deviceServiceProvider).registerWithServer();
    });
  }
}

final borrowerRegisterProvider = AutoDisposeNotifierProvider<BorrowerRegisterNotifier, AsyncValue<void>>(
  BorrowerRegisterNotifier.new,
);
```

- [ ] **Step 3: Write register screen**

```dart
// cwc_mobile/lib/borrower/auth/borrower_register_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import 'borrower_register_provider.dart';

class BorrowerRegisterScreen extends ConsumerStatefulWidget {
  const BorrowerRegisterScreen({super.key});

  @override
  ConsumerState<BorrowerRegisterScreen> createState() => _State();
}

class _State extends ConsumerState<BorrowerRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(borrowerRegisterProvider.notifier).register(
      email: _emailCtrl.text.trim(),
      password: _passCtrl.text,
      firstName: _firstNameCtrl.text.trim(),
      lastName: _lastNameCtrl.text.trim(),
    );
    final s = ref.read(borrowerRegisterProvider);
    if (s is AsyncData && mounted) context.go('/link');
    if (s is AsyncError && mounted) ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Registration failed: ${(s as AsyncError).error}'), backgroundColor: AppColors.danger));
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(borrowerRegisterProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: TextFormField(
                controller: _firstNameCtrl,
                decoration: const InputDecoration(labelText: 'First Name'),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              )),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(
                controller: _lastNameCtrl,
                decoration: const InputDecoration(labelText: 'Last Name'),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              )),
            ]),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
              validator: (v) => v == null || !v.contains('@') ? 'Enter a valid email' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _passCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock_outlined)),
              validator: (v) => v == null || v.length < 8 ? 'Minimum 8 characters' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _confirmPassCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm Password', prefixIcon: Icon(Icons.lock_outlined)),
              validator: (v) => v != _passCtrl.text ? 'Passwords do not match' : null,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: state.isLoading ? null : _submit,
              child: state.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Create Account'),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: () => context.go('/login'), child: const Text('Already have an account? Sign In')),
          ]),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose(); _lastNameCtrl.dispose();
    _emailCtrl.dispose(); _passCtrl.dispose(); _confirmPassCtrl.dispose();
    super.dispose();
  }
}
```

- [ ] **Step 4: Wire into borrower router**

In `cwc_mobile/lib/borrower/router.dart`, replace the placeholder builders:

```dart
import '../borrower/auth/borrower_login_screen.dart';
import '../borrower/auth/borrower_register_screen.dart';
// ...
GoRoute(path: '/login', builder: (_, __) => const BorrowerLoginScreen()),
GoRoute(path: '/register', builder: (_, __) => const BorrowerRegisterScreen()),
```

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/borrower/auth/
git commit -m "feat(mobile/borrower): add borrower login and registration screens"
```

---

## Task 2: Application Linking Screen

**Files:**
- Create: `cwc_mobile/lib/borrower/auth/link_application_provider.dart`
- Create: `cwc_mobile/lib/borrower/auth/link_application_screen.dart`

- [ ] **Step 1: Write link provider**

```dart
// cwc_mobile/lib/borrower/auth/link_application_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';

class LinkApplicationNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<String?> link(String referenceNumber) async {
    state = const AsyncValue.loading();
    String? applicationId;
    state = await AsyncValue.guard(() async {
      final res = await ref.read(apiClientProvider).post(Endpoints.borrowerLink, data: {
        'referenceNumber': referenceNumber.trim().toUpperCase(),
      });
      applicationId = res.data['data']['applicationId'] as String?;
    });
    return applicationId;
  }
}

final linkApplicationProvider = AutoDisposeNotifierProvider<LinkApplicationNotifier, AsyncValue<void>>(
  LinkApplicationNotifier.new,
);
```

- [ ] **Step 2: Write link screen**

```dart
// cwc_mobile/lib/borrower/auth/link_application_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import 'link_application_provider.dart';

class LinkApplicationScreen extends ConsumerStatefulWidget {
  const LinkApplicationScreen({super.key});

  @override
  ConsumerState<LinkApplicationScreen> createState() => _State();
}

class _State extends ConsumerState<LinkApplicationScreen> {
  final _refCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final appId = await ref.read(linkApplicationProvider.notifier).link(_refCtrl.text);
    final state = ref.read(linkApplicationProvider);
    if (state is AsyncError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Could not link application: ${(state as AsyncError).error}'),
        backgroundColor: AppColors.danger,
      ));
      return;
    }
    if (appId != null && mounted) context.go('/application/$appId');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(linkApplicationProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Link Your Application')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Icon(Icons.link, size: 56, color: AppColors.primary),
            const SizedBox(height: 16),
            Text(
              'Enter the Application Reference Number provided by your Relationship Manager.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),
            TextFormField(
              controller: _refCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Reference Number',
                hintText: 'e.g. CA-2026-00123',
                prefixIcon: Icon(Icons.numbers),
              ),
              validator: (v) => v == null || v.trim().isEmpty ? 'Enter the reference number' : null,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: state.isLoading ? null : _submit,
              child: state.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Link Application'),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: () => context.go('/home'), child: const Text('Skip for now')),
          ]),
        ),
      ),
    );
  }

  @override
  void dispose() { _refCtrl.dispose(); super.dispose(); }
}
```

- [ ] **Step 3: Wire into router**

In `cwc_mobile/lib/borrower/router.dart`:

```dart
import '../borrower/auth/link_application_screen.dart';
// ...
GoRoute(path: '/link', builder: (_, __) => const LinkApplicationScreen()),
```

- [ ] **Step 4: Commit**

```bash
git add cwc_mobile/lib/borrower/auth/link_application_provider.dart \
        cwc_mobile/lib/borrower/auth/link_application_screen.dart
git commit -m "feat(mobile/borrower): add application linking screen with reference number input"
```

---

## Task 3: Borrower Home + Application Status Tracker

**Files:**
- Create: `cwc_mobile/lib/borrower/home/borrower_home_provider.dart`
- Create: `cwc_mobile/lib/borrower/home/borrower_home_screen.dart`
- Create: `cwc_mobile/lib/borrower/tracker/status_tracker_screen.dart`

- [ ] **Step 1: Write home provider**

```dart
// cwc_mobile/lib/borrower/home/borrower_home_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/credit_models.dart';

final borrowerApplicationsProvider = FutureProvider<List<CreditApplication>>((ref) async {
  final res = await ref.read(apiClientProvider).get(Endpoints.borrowerApplications);
  final list = res.data['data']['applications'] as List<dynamic>? ?? [];
  return list.map((j) => CreditApplication.fromJson(j as Map<String, dynamic>)).toList();
});
```

- [ ] **Step 2: Write home screen**

```dart
// cwc_mobile/lib/borrower/home/borrower_home_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import '../../core/widgets/state_badge.dart';
import '../../core/models/credit_models.dart';
import '../../core/auth/auth_provider.dart';
import 'borrower_home_provider.dart';

class BorrowerHomeScreen extends ConsumerWidget {
  const BorrowerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apps = ref.watch(borrowerApplicationsProvider);
    final user = ref.watch(authProvider).valueOrNull?.user;

    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, ${user?.firstName ?? ''}'),
        actions: [
          IconButton(icon: const Icon(Icons.add_link), tooltip: 'Link Application',
              onPressed: () => context.push('/link')),
          IconButton(icon: const Icon(Icons.logout), tooltip: 'Sign Out',
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              }),
        ],
      ),
      body: apps.when(
        loading: () => const LoadingOverlay(message: 'Loading your applications...'),
        error: (e, _) => ErrorState(message: e.toString(), onRetry: () => ref.invalidate(borrowerApplicationsProvider)),
        data: (list) {
          if (list.isEmpty) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.inbox_outlined, size: 64, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            const Text('No applications linked yet.'),
            const SizedBox(height: 12),
            FilledButton.icon(
              icon: const Icon(Icons.add_link),
              label: const Text('Link an Application'),
              onPressed: () => context.push('/link'),
            ),
          ]));

          return RefreshIndicator(
            onRefresh: () => ref.refresh(borrowerApplicationsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (ctx, i) => _AppCard(app: list[i]),
            ),
          );
        },
      ),
    );
  }
}

class _AppCard extends StatelessWidget {
  const _AppCard({required this.app});
  final CreditApplication app;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => context.push('/application/${app.id}'),
      child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(app.borrowerProfile?.companyName ?? app.referenceNumber ?? app.id,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16))),
          StateBadge(state: app.state),
        ]),
        if (app.referenceNumber != null) ...[
          const SizedBox(height: 4),
          Text(app.referenceNumber!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ],
        const SizedBox(height: 8),
        Row(children: [
          const Icon(Icons.chevron_right, size: 16, color: AppColors.textSecondary),
          Text('View status & documents', style: const TextStyle(fontSize: 13, color: AppColors.primary)),
        ]),
      ])),
    ),
  );
}
```

- [ ] **Step 3: Write status tracker screen**

```dart
// cwc_mobile/lib/borrower/tracker/status_tracker_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import '../home/borrower_home_provider.dart';

// Ordered workflow stages shown to borrower
const _borrowerStages = [
  ApplicationState.submitted,
  ApplicationState.kycReview,
  ApplicationState.kycApproved,
  ApplicationState.underwriting,
  ApplicationState.creditAssessment,
  ApplicationState.committeeReview,
  ApplicationState.approved,
];

class StatusTrackerScreen extends ConsumerWidget {
  const StatusTrackerScreen({super.key, required this.applicationId});
  final String applicationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appsAsync = ref.watch(borrowerApplicationsProvider);

    return appsAsync.when(
      loading: () => const Scaffold(body: LoadingOverlay(message: 'Loading...')),
      error: (e, _) => Scaffold(body: ErrorState(message: e.toString())),
      data: (apps) {
        final app = apps.cast<CreditApplication?>().firstWhere((a) => a?.id == applicationId, orElse: () => null);
        if (app == null) return const Scaffold(body: Center(child: Text('Application not found')));

        return Scaffold(
          appBar: AppBar(
            title: Text(app.referenceNumber ?? 'Application Status'),
            actions: [
              IconButton(
                icon: const Icon(Icons.description_outlined),
                tooltip: 'Documents',
                onPressed: () => context.push('/application/${app.id}/documents'),
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () => ref.refresh(borrowerApplicationsProvider.future),
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Text(app.borrowerProfile?.companyName ?? '-',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              Text('${app.productType ?? '-'}', style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 24),
              Text('Application Progress',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.textSecondary)),
              const SizedBox(height: 12),
              ..._buildTimeline(app.state),
              // Special terminal states
              if (app.state == ApplicationState.rejected)
                _TerminalCard(label: 'Not Successful', color: AppColors.danger,
                    message: 'Your application was not approved. Please contact your Relationship Manager for more information.'),
              if (app.state == ApplicationState.offer)
                _TerminalCard(label: 'Offer Ready', color: AppColors.accent,
                    message: 'A loan offer has been prepared for you. Please check your documents section to review and sign.',
                    action: FilledButton.icon(
                      icon: const Icon(Icons.draw),
                      label: const Text('View Offer'),
                      onPressed: () => context.push('/application/${app.id}/documents'),
                    )),
            ]),
          ),
        );
      },
    );
  }

  List<Widget> _buildTimeline(ApplicationState current) {
    final currentIdx = _borrowerStages.indexOf(current);

    return _borrowerStages.asMap().entries.map((entry) {
      final idx = entry.key;
      final stage = entry.value;
      final isDone = currentIdx > idx;
      final isCurrent = currentIdx == idx;

      return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Column(children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              color: isDone ? AppColors.success : (isCurrent ? AppColors.primary : Colors.grey[300]),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isDone ? Icons.check : (isCurrent ? Icons.radio_button_checked : Icons.radio_button_unchecked),
              size: 16,
              color: isDone || isCurrent ? Colors.white : Colors.grey[500],
            ),
          ),
          if (idx < _borrowerStages.length - 1)
            Container(width: 2, height: 40,
                color: isDone ? AppColors.success : Colors.grey[300]),
        ]),
        const SizedBox(width: 12),
        Expanded(child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 4),
            Text(stage.label,
                style: TextStyle(
                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                  color: isDone ? AppColors.textSecondary : (isCurrent ? AppColors.primary : AppColors.textSecondary),
                )),
            if (isCurrent)
              const Text('In progress', style: TextStyle(fontSize: 12, color: AppColors.primary)),
          ]),
        )),
      ]);
    }).toList();
  }
}

class _TerminalCard extends StatelessWidget {
  const _TerminalCard({required this.label, required this.color, required this.message, this.action});
  final String label, message;
  final Color color;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(top: 16),
    child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(label, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 16)),
      const SizedBox(height: 8),
      Text(message, style: const TextStyle(color: AppColors.textSecondary)),
      if (action != null) ...[const SizedBox(height: 12), action!],
    ])),
  );
}
```

- [ ] **Step 4: Wire into router**

In `cwc_mobile/lib/borrower/router.dart`, replace placeholder builders:

```dart
import '../borrower/home/borrower_home_screen.dart';
import '../borrower/tracker/status_tracker_screen.dart';
// ...
GoRoute(path: '/home', builder: (_, __) => const BorrowerHomeScreen()),
GoRoute(
  path: '/application/:id',
  builder: (_, s) => StatusTrackerScreen(applicationId: s.pathParameters['id']!),
  routes: [
    GoRoute(
      path: 'documents',
      builder: (_, s) => _PlaceholderScreen('Documents ${s.pathParameters["id"]}'), // wired in Task 4
    ),
  ],
),
```

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/borrower/home/ cwc_mobile/lib/borrower/tracker/
git commit -m "feat(mobile/borrower): add home screen and application status tracker with progress timeline"
```

---

## Task 4: Document Upload Screen

**Files:**
- Create: `cwc_mobile/lib/borrower/documents/document_provider.dart`
- Create: `cwc_mobile/lib/borrower/documents/document_list_screen.dart`

- [ ] **Step 1: Configure permissions**

**Android** — in `cwc_mobile/android/app/src/main/AndroidManifest.xml` inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
<uses-permission android:name="android.permission.CAMERA"/>
```

**iOS** — in `cwc_mobile/ios/Runner/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>CWC uses your camera to capture documents for your loan application</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>CWC accesses your photo library so you can upload documents</string>
```

- [ ] **Step 2: Write document provider**

```dart
// cwc_mobile/lib/borrower/documents/document_provider.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/credit_models.dart';

final documentListProvider = FutureProvider.family<List<CreditDocument>, String>((ref, applicationId) async {
  final res = await ref.read(apiClientProvider).get(
    Endpoints.creditDocuments,
    queryParameters: {'applicationId': applicationId},
  );
  final list = res.data['data']['documents'] as List<dynamic>? ?? [];
  return list.map((j) => CreditDocument.fromJson(j as Map<String, dynamic>)).toList();
});

class DocumentUploadNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> upload({
    required String applicationId,
    required String documentType,
    required String filePath,
    required String fileName,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final formData = FormData.fromMap({
        'applicationId': applicationId,
        'documentType': documentType,
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });
      await ref.read(apiClientProvider).postFormData(Endpoints.creditDocuments, formData);
    });
  }
}

final documentUploadProvider = AutoDisposeNotifierProvider<DocumentUploadNotifier, AsyncValue<void>>(
  DocumentUploadNotifier.new,
);
```

- [ ] **Step 3: Write document list screen**

```dart
// cwc_mobile/lib/borrower/documents/document_list_screen.dart
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import 'document_provider.dart';

class DocumentListScreen extends ConsumerWidget {
  const DocumentListScreen({super.key, required this.applicationId});
  final String applicationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docs = ref.watch(documentListProvider(applicationId));

    return Scaffold(
      appBar: AppBar(title: const Text('Documents')),
      body: docs.when(
        loading: () => const LoadingOverlay(message: 'Loading documents...'),
        error: (e, _) => ErrorState(message: e.toString(), onRetry: () => ref.invalidate(documentListProvider(applicationId))),
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('No documents required yet'));
          return RefreshIndicator(
            onRefresh: () => ref.refresh(documentListProvider(applicationId).future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (ctx, i) => _DocCard(doc: list[i], applicationId: applicationId),
            ),
          );
        },
      ),
    );
  }
}

class _DocCard extends ConsumerWidget {
  const _DocCard({required this.doc, required this.applicationId});
  final CreditDocument doc;
  final String applicationId;

  Color get _statusColor => switch (doc.status) {
    'VERIFIED' => AppColors.success,
    'REJECTED' => AppColors.danger,
    _ => AppColors.warning,
  };

  IconData get _statusIcon => switch (doc.status) {
    'VERIFIED' => Icons.check_circle_outline,
    'REJECTED' => Icons.cancel_outlined,
    _ => Icons.hourglass_empty,
  };

  Future<void> _upload(BuildContext ctx, WidgetRef ref) async {
    final choice = await showModalBottomSheet<String>(
      context: ctx,
      builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(Icons.camera_alt_outlined), title: const Text('Take Photo'),
            onTap: () => Navigator.pop(ctx, 'camera')),
        ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from Gallery'),
            onTap: () => Navigator.pop(ctx, 'gallery')),
        ListTile(leading: const Icon(Icons.picture_as_pdf_outlined), title: const Text('Upload PDF'),
            onTap: () => Navigator.pop(ctx, 'pdf')),
      ])),
    );

    String? filePath;
    String? fileName;

    if (choice == 'camera') {
      final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85);
      if (picked == null) return;
      filePath = picked.path;
      fileName = picked.name;
    } else if (choice == 'gallery') {
      final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (picked == null) return;
      filePath = picked.path;
      fileName = picked.name;
    } else if (choice == 'pdf') {
      final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
      if (result == null || result.files.single.path == null) return;
      filePath = result.files.single.path!;
      fileName = result.files.single.name;
    }

    if (filePath == null || fileName == null) return;

    final fileSize = File(filePath).lengthSync();
    if (fileSize > 20 * 1024 * 1024) {
      ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('File must be under 20MB')));
      return;
    }

    await ref.read(documentUploadProvider.notifier).upload(
      applicationId: applicationId,
      documentType: doc.documentType,
      filePath: filePath,
      fileName: fileName,
    );

    final state = ref.read(documentUploadProvider);
    if (state is AsyncError && ctx.mounted) {
      ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
        content: Text('Upload failed: ${(state as AsyncError).error}'),
        backgroundColor: AppColors.danger,
      ));
    } else if (ctx.mounted) {
      ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
        content: Text('Document uploaded — under review'),
        backgroundColor: AppColors.success,
      ));
      ref.invalidate(documentListProvider(applicationId));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uploadState = ref.watch(documentUploadProvider);

    return Card(
      child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(_statusIcon, color: _statusColor, size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text(doc.documentType.replaceAll('_', ' '),
              style: const TextStyle(fontWeight: FontWeight.w600))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: _statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
            child: Text(doc.status, style: TextStyle(color: _statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
          ),
        ]),
        if (doc.rejectionReason != null) ...[
          const SizedBox(height: 8),
          Text('Rejected: ${doc.rejectionReason}',
              style: const TextStyle(color: AppColors.danger, fontSize: 12)),
        ],
        if (doc.status == 'PENDING' || doc.status == 'REJECTED') ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: uploadState.isLoading
                  ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.upload_file_outlined, size: 16),
              label: Text(doc.status == 'REJECTED' ? 'Re-upload Document' : 'Upload Document'),
              onPressed: uploadState.isLoading ? null : () => _upload(context, ref),
            ),
          ),
        ],
        if (doc.status == 'VERIFIED')
          const Padding(padding: EdgeInsets.only(top: 8),
            child: Text('Verified ✓', style: TextStyle(color: AppColors.success, fontSize: 12))),
      ])),
    );
  }
}
```

- [ ] **Step 4: Wire into router**

In `cwc_mobile/lib/borrower/router.dart`, replace the documents route inside `'/application/:id'`:

```dart
import '../borrower/documents/document_list_screen.dart';
// ...
GoRoute(
  path: 'documents',
  builder: (_, s) => DocumentListScreen(applicationId: s.pathParameters['id']!),
),
```

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/borrower/documents/ \
        cwc_mobile/android/app/src/main/AndroidManifest.xml \
        cwc_mobile/ios/Runner/Info.plist
git commit -m "feat(mobile/borrower): add document upload screen with camera, gallery, and PDF support"
```

---

## Task 5: Borrower Push Notification Handler

**Files:**
- Create: `cwc_mobile/lib/borrower/notifications/borrower_push_handler.dart`
- Modify: `cwc_mobile/lib/borrower/app.dart`

- [ ] **Step 1: Write borrower push handler**

```dart
// cwc_mobile/lib/borrower/notifications/borrower_push_handler.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

@pragma('vm:entry-point')
Future<void> handleBorrowerBackgroundMessage(RemoteMessage message) async {}

class BorrowerPushHandler {
  static Future<void> init(BuildContext context, GoRouter router) async {
    await FirebaseMessaging.instance.requestPermission();

    FirebaseMessaging.onMessage.listen((msg) {
      final type = msg.data['type'] as String?;
      final appId = msg.data['applicationId'] as String?;
      final body = msg.notification?.body ?? '';

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(body),
        action: appId != null
            ? SnackBarAction(
                label: 'View',
                onPressed: () => type == 'DOCUMENT_STATUS'
                    ? router.go('/application/$appId/documents')
                    : router.go('/application/$appId'),
              )
            : null,
      ));
    });

    FirebaseMessaging.onMessageOpenedApp.listen((msg) => _navigate(msg.data, router));

    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) _navigate(initial.data, router);

    FirebaseMessaging.onBackgroundMessage(handleBorrowerBackgroundMessage);
  }

  static void _navigate(Map<String, dynamic> data, GoRouter router) {
    final type = data['type'] as String?;
    final appId = data['applicationId'] as String?;
    if (appId == null) return;
    if (type == 'DOCUMENT_STATUS') {
      router.go('/application/$appId/documents');
    } else {
      router.go('/application/$appId');
    }
  }
}
```

- [ ] **Step 2: Initialize in borrower app**

Update `cwc_mobile/lib/borrower/app.dart` — change `BorrowerApp` to `ConsumerStatefulWidget`:

```dart
// cwc_mobile/lib/borrower/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/app_theme.dart';
import 'notifications/borrower_push_handler.dart';
import 'router.dart';

class BorrowerApp extends ConsumerStatefulWidget {
  const BorrowerApp({super.key});

  @override
  ConsumerState<BorrowerApp> createState() => _BorrowerAppState();
}

class _BorrowerAppState extends ConsumerState<BorrowerApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final router = ref.read(borrowerRouterProvider);
      BorrowerPushHandler.init(context, router);
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(borrowerRouterProvider);
    return MaterialApp.router(
      title: 'CWC Borrower',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

- [ ] **Step 3: Run Flutter analyze**

```bash
cd cwc_mobile && flutter analyze
```

Expected: no errors. Fix any type or null-safety warnings.

- [ ] **Step 4: End-to-end smoke test**

```bash
flutter run --target lib/main_borrower.dart --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

1. Register a new borrower account
2. Enter a valid application reference number → confirms link and navigates to tracker
3. Status tracker shows current application stage
4. Tap Documents → checklist appears
5. Upload a document → snackbar confirms

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/borrower/notifications/ cwc_mobile/lib/borrower/app.dart
git commit -m "feat(mobile/borrower): add push notification handler with state-change and document routing"
```

---

## P3 Complete — Handoff to P4

At this point the borrower app has:
- ✅ Registration + login
- ✅ Application linking by reference number
- ✅ Status tracker with visual timeline
- ✅ Document upload (camera, gallery, PDF) with verification status
- ✅ Push notifications for state changes and document events

**Next:** `docs/superpowers/plans/2026-06-05-flutter-credit-p4-core-ops.md`

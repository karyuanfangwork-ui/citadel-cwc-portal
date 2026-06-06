# Flutter Credit Mobile App — P2: Staff App MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the five Staff App MVP screens — Login, Approval Inbox, Committee Voting, Dashboard, and Application List/Detail — replacing all placeholder screens from P1 with fully wired Flutter UI backed by the existing credit API.

**Architecture:** Each screen is a ConsumerWidget backed by a Riverpod AsyncNotifier provider that calls the existing Express API via the P1 `ApiClient`. No new backend endpoints required — all data is served by existing `/api/v1/credit/` routes. Screens are registered in `staff/router.dart` replacing the P1 placeholder builders.

**Tech Stack:** Flutter 3.19+, flutter_riverpod 2.5.1, go_router 13.2.0, Dio 5.4.3 (from P1 core)

**Prerequisites:** P1 Foundation plan complete. All files in `cwc_mobile/lib/core/` exist and compile.

**Spec:** `docs/superpowers/specs/2026-06-05-flutter-credit-mobile-app-design.md` §2

---

## File Map

```
cwc_mobile/lib/staff/
├── auth/
│   ├── login_screen.dart
│   └── login_provider.dart
├── dashboard/
│   ├── dashboard_screen.dart
│   └── dashboard_provider.dart
├── approvals/
│   ├── approval_inbox_screen.dart
│   ├── approval_inbox_provider.dart
│   └── approval_detail_sheet.dart
├── committee/
│   ├── committee_vote_screen.dart
│   └── committee_vote_provider.dart
├── applications/
│   ├── application_list_screen.dart
│   ├── application_detail_screen.dart
│   └── application_provider.dart
```

---

## Task 1: Staff Login Screen

**Files:**
- Create: `cwc_mobile/lib/staff/auth/login_provider.dart`
- Create: `cwc_mobile/lib/staff/auth/login_screen.dart`
- Modify: `cwc_mobile/lib/staff/router.dart`

- [ ] **Step 1: Write login provider**

```dart
// cwc_mobile/lib/staff/auth/login_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/device_provider.dart';

class LoginNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await ref.read(authProvider.notifier).login(email, password);
      await ref.read(deviceServiceProvider).registerWithServer();
    });
  }
}

final loginProvider = AutoDisposeNotifierProvider<LoginNotifier, AsyncValue<void>>(LoginNotifier.new);
```

- [ ] **Step 2: Write login screen**

```dart
// cwc_mobile/lib/staff/auth/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/device_provider.dart';
import '../../core/theme/app_theme.dart';
import 'login_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _tryBiometric();
  }

  Future<void> _tryBiometric() async {
    final deviceService = ref.read(deviceServiceProvider);
    final canUse = await deviceService.canUseBiometrics();
    if (!canUse) return;
    final storage = ref.read(secureStorageProvider);
    final token = await storage.getAccessToken();
    if (token == null) return; // no saved session

    final ok = await deviceService.authenticateWithBiometrics();
    if (ok && mounted) {
      final user = await ref.read(authServiceProvider).restoreSession();
      if (user != null && mounted) {
        await ref.read(deviceServiceProvider).registerWithServer();
        context.go('/dashboard');
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(loginProvider.notifier).login(_emailCtrl.text.trim(), _passCtrl.text);
    final loginState = ref.read(loginProvider);
    loginState.whenOrNull(
      error: (e, _) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Login failed: ${e.toString()}'), backgroundColor: AppColors.danger),
      ),
    );
    if (ref.read(authProvider).valueOrNull?.status == AuthStatus.authenticated && mounted) {
      context.go('/dashboard');
    }
  }

  @override
  Widget build(BuildContext context) {
    final loginState = ref.watch(loginProvider);
    final isLoading = loginState.isLoading;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.account_balance, size: 64, color: AppColors.primary),
                const SizedBox(height: 8),
                Text('CWC Credit', style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: AppColors.primary, fontWeight: FontWeight.bold)),
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
                  onPressed: isLoading ? null : _submit,
                  child: isLoading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() { _emailCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }
}
```

- [ ] **Step 3: Wire into router**

In `cwc_mobile/lib/staff/router.dart`, replace the `'/login'` route builder:

```dart
import '../staff/auth/login_screen.dart';
// ...
GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
```

- [ ] **Step 4: Verify login screen**

```bash
cd cwc_mobile
flutter run --target lib/main_staff.dart --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Expected: Login screen shows with email/password fields. Sign in with `it@test.local` / `abc@123` → navigates to Dashboard placeholder.

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/staff/auth/
git commit -m "feat(mobile/staff): add login screen with biometric auto-auth"
```

---

## Task 2: Approval Inbox Screen

**Files:**
- Create: `cwc_mobile/lib/staff/approvals/approval_inbox_provider.dart`
- Create: `cwc_mobile/lib/staff/approvals/approval_detail_sheet.dart`
- Create: `cwc_mobile/lib/staff/approvals/approval_inbox_screen.dart`

*Port of `frontend/pages/credit/MobileApprovalInbox.tsx`*

- [ ] **Step 1: Write approval inbox provider**

```dart
// cwc_mobile/lib/staff/approvals/approval_inbox_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/credit_models.dart';

enum InboxFilter { all, urgent, awaitingMe }

class ApprovalInboxNotifier extends AsyncNotifier<List<ApprovalInboxItem>> {
  var _filter = InboxFilter.all;

  @override
  Future<List<ApprovalInboxItem>> build() => _fetch();

  Future<List<ApprovalInboxItem>> _fetch() async {
    final res = await ref.read(apiClientProvider).get('${Endpoints.creditDashboard}/approval-inbox');
    final raw = res.data['data'] as Map<String, dynamic>? ?? {};
    final items = (raw['items'] as List<dynamic>? ?? [])
        .map((j) => ApprovalInboxItem.fromJson(j as Map<String, dynamic>))
        .toList();
    return _applyFilter(items);
  }

  List<ApprovalInboxItem> _applyFilter(List<ApprovalInboxItem> items) => switch (_filter) {
    InboxFilter.urgent => items.where((i) => i.isUrgent).toList(),
    InboxFilter.awaitingMe => items,
    InboxFilter.all => items,
  };

  void setFilter(InboxFilter f) {
    _filter = f;
    ref.invalidateSelf();
  }

  Future<void> refresh() => ref.invalidateSelf().then((_) => future);

  Future<void> decide(String approvalId, String decision, {String? comment}) async {
    await ref.read(apiClientProvider).post(
      '${Endpoints.creditApprovals}/$approvalId/decide',
      data: {'decision': decision, if (comment != null) 'comment': comment},
    );
    await refresh();
  }
}

final inboxFilterProvider = StateProvider<InboxFilter>((ref) => InboxFilter.all);
final approvalInboxProvider = AsyncNotifierProvider<ApprovalInboxNotifier, List<ApprovalInboxItem>>(
  ApprovalInboxNotifier.new,
);
```

- [ ] **Step 2: Write approval detail sheet**

```dart
// cwc_mobile/lib/staff/approvals/approval_detail_sheet.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/state_badge.dart';
import 'approval_inbox_provider.dart';

class ApprovalDetailSheet extends ConsumerStatefulWidget {
  const ApprovalDetailSheet({super.key, required this.item});
  final ApprovalInboxItem item;

  @override
  ConsumerState<ApprovalDetailSheet> createState() => _ApprovalDetailSheetState();
}

class _ApprovalDetailSheetState extends ConsumerState<ApprovalDetailSheet> {
  final _commentCtrl = TextEditingController();
  bool _submitting = false;

  Future<void> _decide(String decision) async {
    if (decision == 'REJECT' && _commentCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('A comment is required to reject')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(approvalInboxProvider.notifier).decide(
        widget.item.approvalId, decision,
        comment: _commentCtrl.text.trim().isEmpty ? null : _commentCtrl.text.trim(),
      );
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.item.application;
    final fmt = NumberFormat.currency(symbol: '${app.currency ?? ""} ', decimalDigits: 0);

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, ctrl) => Column(
        children: [
          // Handle bar
          Container(margin: const EdgeInsets.symmetric(vertical: 8),
            height: 4, width: 40,
            decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
          Expanded(
            child: ListView(controller: ctrl, padding: const EdgeInsets.all(16), children: [
              Row(children: [
                Expanded(child: Text(app.borrowerProfile?.companyName ?? app.id,
                    style: Theme.of(context).textTheme.titleLarge)),
                StateBadge(state: app.state),
              ]),
              const SizedBox(height: 8),
              if (app.referenceNumber != null) Text(app.referenceNumber!,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              const Divider(height: 24),
              _InfoRow('Product', app.productType ?? '-'),
              _InfoRow('Amount', app.totalFacilityAmount != null ? fmt.format(app.totalFacilityAmount) : '-'),
              _InfoRow('Days Waiting', '${widget.item.daysWaiting} days'),
              if (widget.item.isUrgent)
                Container(margin: const EdgeInsets.only(top: 8), padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.danger.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                  child: const Text('URGENT', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold, fontSize: 12))),
              const SizedBox(height: 16),
              TextField(
                controller: _commentCtrl,
                decoration: const InputDecoration(labelText: 'Comment (required for rejection)', hintText: 'Enter your decision rationale...'),
                maxLines: 3,
              ),
              const SizedBox(height: 24),
            ]),
          ),
          // Action buttons
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(children: [
                Expanded(child: OutlinedButton(onPressed: _submitting ? null : () => _decide('RETURN'), child: const Text('Return'))),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.warning),
                  onPressed: _submitting ? null : () => _decide('DEFER'),
                  child: const Text('Defer'),
                )),
                const SizedBox(width: 8),
                Expanded(child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
                  onPressed: _submitting ? null : () => _decide('REJECT'),
                  child: const Text('Reject'),
                )),
                const SizedBox(width: 8),
                Expanded(child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.success),
                  onPressed: _submitting ? null : () => _decide('APPROVE'),
                  child: const Text('Approve'),
                )),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() { _commentCtrl.dispose(); super.dispose(); }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label; final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      SizedBox(width: 100, child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
      Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
    ]),
  );
}
```

- [ ] **Step 3: Write approval inbox screen**

```dart
// cwc_mobile/lib/staff/approvals/approval_inbox_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import '../../core/widgets/state_badge.dart';
import 'approval_detail_sheet.dart';
import 'approval_inbox_provider.dart';

class ApprovalInboxScreen extends ConsumerWidget {
  const ApprovalInboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(approvalInboxProvider);
    final filter = ref.watch(inboxFilterProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Approvals')),
      body: Column(children: [
        // Filter chips
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: InboxFilter.values.map((f) {
              final labels = {InboxFilter.all: 'All', InboxFilter.urgent: 'Urgent', InboxFilter.awaitingMe: 'Awaiting Me'};
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(labels[f]!),
                  selected: filter == f,
                  onSelected: (_) {
                    ref.read(inboxFilterProvider.notifier).state = f;
                    ref.read(approvalInboxProvider.notifier).setFilter(f);
                  },
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: items.when(
            loading: () => const LoadingOverlay(message: 'Loading approvals...'),
            error: (e, _) => ErrorState(message: e.toString(), onRetry: () => ref.invalidate(approvalInboxProvider)),
            data: (list) {
              if (list.isEmpty) return const Center(child: Text('No approvals pending'));
              return RefreshIndicator(
                onRefresh: () => ref.read(approvalInboxProvider.notifier).refresh(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, i) => _ApprovalCard(item: list[i]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

class _ApprovalCard extends StatelessWidget {
  const _ApprovalCard({required this.item});
  final ApprovalInboxItem item;

  @override
  Widget build(BuildContext context) {
    final app = item.application;
    final fmt = NumberFormat.currency(symbol: '${app.currency ?? ""} ', decimalDigits: 0);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
          builder: (_) => ApprovalDetailSheet(item: item),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(app.borrowerProfile?.companyName ?? app.id,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16))),
              if (item.isUrgent)
                Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.danger, borderRadius: BorderRadius.circular(4)),
                  child: const Text('URGENT', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
            ]),
            const SizedBox(height: 4),
            Text(app.productType ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: Text(
                app.totalFacilityAmount != null ? fmt.format(app.totalFacilityAmount) : '-',
                style: const TextStyle(fontWeight: FontWeight.w500),
              )),
              StateBadge(state: app.state),
              const SizedBox(width: 8),
              Text('${item.daysWaiting}d', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            ]),
          ]),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Wire into router**

In `cwc_mobile/lib/staff/router.dart`, replace the `'/approvals'` placeholder:

```dart
import '../staff/approvals/approval_inbox_screen.dart';
// ...
GoRoute(path: '/approvals', builder: (_, __) => const ApprovalInboxScreen()),
```

- [ ] **Step 5: Verify screen**

```bash
flutter run --target lib/main_staff.dart --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Tap Approvals tab. Expected: card list loads, tap a card → bottom sheet with APPROVE/REJECT/DEFER/RETURN buttons. Submit REJECT without comment → snackbar error.

- [ ] **Step 6: Commit**

```bash
git add cwc_mobile/lib/staff/approvals/
git commit -m "feat(mobile/staff): add Approval Inbox screen with approve/reject/defer/return actions"
```

---

## Task 3: Committee Voting Screen

**Files:**
- Create: `cwc_mobile/lib/staff/committee/committee_vote_provider.dart`
- Create: `cwc_mobile/lib/staff/committee/committee_vote_screen.dart`

*Port of `frontend/pages/credit/CommitteeMobileVote.tsx`*

- [ ] **Step 1: Write committee models**

Add to `cwc_mobile/lib/core/models/credit_models.dart`:

```dart
class CommitteeAgendaItem {
  const CommitteeAgendaItem({required this.id, required this.applicationId, this.application, this.presentedByName});
  final String id;
  final String applicationId;
  final CreditApplication? application;
  final String? presentedByName;

  factory CommitteeAgendaItem.fromJson(Map<String, dynamic> j) => CommitteeAgendaItem(
    id: j['id'] as String,
    applicationId: j['applicationId'] as String? ?? '',
    application: j['application'] != null ? CreditApplication.fromJson(j['application'] as Map<String, dynamic>) : null,
    presentedByName: (j['presentedBy'] as Map<String, dynamic>?)?['firstName'] as String?,
  );
}

class CommitteeMeeting {
  const CommitteeMeeting({required this.id, required this.title, required this.agendaItems});
  final String id;
  final String title;
  final List<CommitteeAgendaItem> agendaItems;

  factory CommitteeMeeting.fromJson(Map<String, dynamic> j) => CommitteeMeeting(
    id: j['id'] as String,
    title: j['title'] as String? ?? 'Committee Meeting',
    agendaItems: (j['agendaItems'] as List<dynamic>? ?? [])
        .map((i) => CommitteeAgendaItem.fromJson(i as Map<String, dynamic>))
        .toList(),
  );
}
```

- [ ] **Step 2: Write committee vote provider**

```dart
// cwc_mobile/lib/staff/committee/committee_vote_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/credit_models.dart';

final committeeMeetingProvider = FutureProvider.family<CommitteeMeeting, String>((ref, meetingId) async {
  final res = await ref.read(apiClientProvider).get('${Endpoints.creditCommittee}/meetings/$meetingId');
  return CommitteeMeeting.fromJson(res.data['data'] as Map<String, dynamic>);
});

final committeeCurrentIndexProvider = StateProvider<int>((ref) => 0);

class CommitteeVoteNotifier extends AutoDisposeNotifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> castVote({
    required String meetingId,
    required String agendaItemId,
    required String choice,
    String? comment,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await ref.read(apiClientProvider).post(
        '${Endpoints.creditCommittee}/meetings/$meetingId/agenda/$agendaItemId/vote',
        data: {'choice': choice, if (comment != null) 'comment': comment},
      );
    });
  }
}

final committeeVoteProvider = AutoDisposeNotifierProvider<CommitteeVoteNotifier, AsyncValue<void>>(CommitteeVoteNotifier.new);
```

- [ ] **Step 3: Write committee vote screen**

```dart
// cwc_mobile/lib/staff/committee/committee_vote_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import 'committee_vote_provider.dart';

class CommitteeVoteScreen extends ConsumerWidget {
  const CommitteeVoteScreen({super.key, required this.meetingId});
  final String meetingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meetingAsync = ref.watch(committeeMeetingProvider(meetingId));
    return meetingAsync.when(
      loading: () => const Scaffold(body: LoadingOverlay(message: 'Loading meeting...')),
      error: (e, _) => Scaffold(body: ErrorState(message: e.toString())),
      data: (meeting) => _MeetingView(meeting: meeting),
    );
  }
}

class _MeetingView extends ConsumerStatefulWidget {
  const _MeetingView({required this.meeting});
  final CommitteeMeeting meeting;

  @override
  ConsumerState<_MeetingView> createState() => _MeetingViewState();
}

class _MeetingViewState extends ConsumerState<_MeetingView> {
  String? _selectedChoice;
  final _commentCtrl = TextEditingController();
  bool _memoExpanded = false;

  int get _currentIndex => ref.read(committeeCurrentIndexProvider);
  CommitteeAgendaItem? get _currentItem =>
      widget.meeting.agendaItems.isNotEmpty ? widget.meeting.agendaItems[_currentIndex] : null;

  Future<void> _vote() async {
    if (_selectedChoice == null) return;
    if (_selectedChoice == 'REJECT' && _commentCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Comment required for rejection')));
      return;
    }
    await ref.read(committeeVoteProvider.notifier).castVote(
      meetingId: widget.meeting.id,
      agendaItemId: _currentItem!.id,
      choice: _selectedChoice!,
      comment: _commentCtrl.text.trim().isEmpty ? null : _commentCtrl.text.trim(),
    );
    final voteState = ref.read(committeeVoteProvider);
    if (voteState is AsyncError) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Vote failed: ${voteState.error}')));
      return;
    }
    // Move to next
    final total = widget.meeting.agendaItems.length;
    if (_currentIndex < total - 1) {
      ref.read(committeeCurrentIndexProvider.notifier).state = _currentIndex + 1;
      setState(() { _selectedChoice = null; _commentCtrl.clear(); });
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.meeting.agendaItems.length;
    final item = _currentItem;
    final app = item?.application;
    final fmt = NumberFormat.currency(symbol: '${app?.currency ?? ""} ', decimalDigits: 0);
    final voteState = ref.watch(committeeVoteProvider);

    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.meeting.title, style: const TextStyle(fontSize: 16)),
          Text('Deal ${_currentIndex + 1} of $total', style: const TextStyle(fontSize: 12, color: Colors.white70)),
        ]),
      ),
      body: item == null ? const Center(child: Text('No agenda items')) : Column(
        children: [
          // Memo collapsible
          InkWell(
            onTap: () => setState(() => _memoExpanded = !_memoExpanded),
            child: Container(
              color: AppColors.surface,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(children: [
                const Icon(Icons.description_outlined, size: 18, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                const Expanded(child: Text('View Credit Memo', style: TextStyle(fontSize: 13))),
                Icon(_memoExpanded ? Icons.expand_less : Icons.expand_more),
              ]),
            ),
          ),
          if (_memoExpanded)
            Container(
              color: AppColors.surface,
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(app?.borrowerProfile?.companyName ?? '-', style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('${app?.productType ?? '-'} · ${app?.totalFacilityAmount != null ? fmt.format(app!.totalFacilityAmount) : '-'}'),
              ]),
            ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                Text(app?.borrowerProfile?.companyName ?? '-',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('${app?.productType ?? '-'}  ·  ${app?.totalFacilityAmount != null ? fmt.format(app!.totalFacilityAmount) : '-'}'),
                const SizedBox(height: 24),
                // Vote buttons
                Row(children: [
                  _VoteBtn('APPROVE', 'Approve', AppColors.success, _selectedChoice, (c) => setState(() => _selectedChoice = c)),
                  const SizedBox(width: 8),
                  _VoteBtn('CONDITIONAL', 'Conditional', AppColors.warning, _selectedChoice, (c) => setState(() => _selectedChoice = c)),
                  const SizedBox(width: 8),
                  _VoteBtn('DEFER', 'Defer', AppColors.textSecondary, _selectedChoice, (c) => setState(() => _selectedChoice = c)),
                  const SizedBox(width: 8),
                  _VoteBtn('REJECT', 'Reject', AppColors.danger, _selectedChoice, (c) => setState(() => _selectedChoice = c)),
                ]),
                if (_selectedChoice == 'REJECT' || _selectedChoice == 'CONDITIONAL') ...[
                  const SizedBox(height: 16),
                  TextField(
                    controller: _commentCtrl,
                    decoration: InputDecoration(
                      labelText: _selectedChoice == 'REJECT' ? 'Rejection reason (required)' : 'Conditions (optional)'),
                    maxLines: 3,
                  ),
                ],
                const Spacer(),
              ]),
            ),
          ),
          // Submit + progress dots
          SafeArea(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              // Progress dots
              Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(total, (i) =>
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _currentIndex ? 16 : 8, height: 8,
                  decoration: BoxDecoration(
                    color: i < _currentIndex ? AppColors.success : (i == _currentIndex ? AppColors.primary : Colors.grey[300]),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              )),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _selectedChoice == null || voteState.isLoading ? null : _vote,
                child: voteState.isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text(_currentIndex < total - 1 ? 'Submit & Next' : 'Submit & Finish'),
              ),
            ]),
          )),
        ],
      ),
    );
  }

  @override
  void dispose() { _commentCtrl.dispose(); super.dispose(); }
}

class _VoteBtn extends StatelessWidget {
  const _VoteBtn(this.value, this.label, this.color, this.selected, this.onTap);
  final String value, label;
  final Color color;
  final String? selected;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: () => onTap(value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 56,
        decoration: BoxDecoration(
          color: selected == value ? color : color.withOpacity(0.1),
          border: Border.all(color: color),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(child: Text(label, style: TextStyle(
          color: selected == value ? Colors.white : color,
          fontWeight: FontWeight.bold, fontSize: 12,
        ))),
      ),
    ),
  );
}
```

- [ ] **Step 4: Wire into router**

In `cwc_mobile/lib/staff/router.dart`, replace the `'/committee'` route:

```dart
import '../staff/committee/committee_vote_screen.dart';
// ...
GoRoute(
  path: '/committee',
  builder: (_, __) => const _PlaceholderScreen('Committee List'), // list screen — P4
  routes: [
    GoRoute(
      path: ':meetingId/vote',
      builder: (_, s) => CommitteeVoteScreen(meetingId: s.pathParameters['meetingId']!),
    ),
  ],
),
```

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/staff/committee/ cwc_mobile/lib/core/models/credit_models.dart
git commit -m "feat(mobile/staff): add Committee Voting screen with swipe agenda and vote submission"
```

---

## Task 4: Dashboard Screen

**Files:**
- Create: `cwc_mobile/lib/staff/dashboard/dashboard_provider.dart`
- Create: `cwc_mobile/lib/staff/dashboard/dashboard_screen.dart`

- [ ] **Step 1: Write dashboard provider**

```dart
// cwc_mobile/lib/staff/dashboard/dashboard_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';

class DashboardStats {
  const DashboardStats({
    required this.pendingApprovals,
    required this.urgentCount,
    required this.stateCounts,
    required this.slaBreaches,
  });

  final int pendingApprovals;
  final int urgentCount;
  final Map<String, int> stateCounts;
  final int slaBreaches;

  factory DashboardStats.fromJson(Map<String, dynamic> j) {
    final summary = j['summary'] as Map<String, dynamic>? ?? {};
    return DashboardStats(
      pendingApprovals: summary['pendingApprovals'] as int? ?? 0,
      urgentCount: summary['urgentCount'] as int? ?? 0,
      stateCounts: Map<String, int>.from(summary['stateCounts'] as Map? ?? {}),
      slaBreaches: summary['slaBreaches'] as int? ?? 0,
    );
  }
}

final dashboardProvider = FutureProvider<DashboardStats>((ref) async {
  final res = await ref.read(apiClientProvider).get('${Endpoints.creditDashboard}/summary');
  return DashboardStats.fromJson(res.data['data'] as Map<String, dynamic>? ?? {});
});
```

- [ ] **Step 2: Write dashboard screen**

```dart
// cwc_mobile/lib/staff/dashboard/dashboard_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import 'dashboard_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(dashboardProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: stats.when(
        loading: () => const LoadingOverlay(message: 'Loading dashboard...'),
        error: (e, _) => ErrorState(message: e.toString(), onRetry: () => ref.invalidate(dashboardProvider)),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(dashboardProvider.future),
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Text('Overview', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _StatCard('Pending Approvals', '${data.pendingApprovals}',
                  AppColors.primary, Icons.approval_outlined,
                  onTap: () => context.go('/approvals'))),
              const SizedBox(width: 12),
              Expanded(child: _StatCard('Urgent', '${data.urgentCount}',
                  AppColors.danger, Icons.warning_amber_outlined)),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _StatCard('SLA Breaches', '${data.slaBreaches}',
                  AppColors.warning, Icons.timer_off_outlined)),
              const SizedBox(width: 12),
              Expanded(child: _StatCard('Active', '${data.stateCounts["UNDERWRITING"] ?? 0}',
                  AppColors.success, Icons.trending_up)),
            ]),
            const SizedBox(height: 24),
            Text('Pipeline', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...data.stateCounts.entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _PipelineRow(e.key, e.value, data.stateCounts.values.fold(0, (a, b) => a + b)),
            )),
          ]),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.label, this.value, this.color, this.icon, {this.onTap});
  final String label, value;
  final Color color;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
      ])),
    ),
  );
}

class _PipelineRow extends StatelessWidget {
  const _PipelineRow(this.state, this.count, this.total);
  final String state;
  final int count, total;

  @override
  Widget build(BuildContext context) {
    final pct = total == 0 ? 0.0 : count / total;
    final label = state.replaceAll('_', ' ').toLowerCase();
    return Row(children: [
      SizedBox(width: 140, child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
      Expanded(child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(value: pct, minHeight: 8, backgroundColor: Colors.grey[200]),
      )),
      const SizedBox(width: 8),
      Text('$count', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
    ]);
  }
}
```

- [ ] **Step 3: Wire into router**

In `cwc_mobile/lib/staff/router.dart`:

```dart
import '../staff/dashboard/dashboard_screen.dart';
// ...
GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
```

- [ ] **Step 4: Commit**

```bash
git add cwc_mobile/lib/staff/dashboard/
git commit -m "feat(mobile/staff): add Dashboard screen with pipeline KPIs and approval shortcuts"
```

---

## Task 5: Application List + Detail Screens

**Files:**
- Create: `cwc_mobile/lib/staff/applications/application_provider.dart`
- Create: `cwc_mobile/lib/staff/applications/application_list_screen.dart`
- Create: `cwc_mobile/lib/staff/applications/application_detail_screen.dart`

- [ ] **Step 1: Write application provider**

```dart
// cwc_mobile/lib/staff/applications/application_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_provider.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/credit_models.dart';

final applicationListProvider = FutureProvider<List<CreditApplication>>((ref) async {
  final res = await ref.read(apiClientProvider).get(Endpoints.creditApplications);
  final list = res.data['data']['applications'] as List<dynamic>? ?? [];
  return list.map((j) => CreditApplication.fromJson(j as Map<String, dynamic>)).toList();
});

final applicationDetailProvider = FutureProvider.family<CreditApplication, String>((ref, id) async {
  final res = await ref.read(apiClientProvider).get('${Endpoints.creditApplications}/$id');
  return CreditApplication.fromJson(res.data['data']['application'] as Map<String, dynamic>);
});
```

- [ ] **Step 2: Write application list screen**

```dart
// cwc_mobile/lib/staff/applications/application_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/models/credit_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import '../../core/widgets/state_badge.dart';
import 'application_provider.dart';

class ApplicationListScreen extends ConsumerStatefulWidget {
  const ApplicationListScreen({super.key});

  @override
  ConsumerState<ApplicationListScreen> createState() => _ApplicationListScreenState();
}

class _ApplicationListScreenState extends ConsumerState<ApplicationListScreen> {
  String _search = '';
  ApplicationState? _filterState;

  @override
  Widget build(BuildContext context) {
    final apps = ref.watch(applicationListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Applications')),
      body: Column(children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Search by borrower or reference...',
              prefixIcon: Icon(Icons.search),
              isDense: true,
            ),
            onChanged: (v) => setState(() => _search = v.toLowerCase()),
          ),
        ),
        // State filter chips
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            children: [null, ...ApplicationState.values].map((s) => Padding(
              padding: const EdgeInsets.only(right: 6),
              child: FilterChip(
                label: Text(s?.label ?? 'All', style: const TextStyle(fontSize: 11)),
                selected: _filterState == s,
                onSelected: (_) => setState(() => _filterState = s),
              ),
            )).toList(),
          ),
        ),
        Expanded(
          child: apps.when(
            loading: () => const LoadingOverlay(message: 'Loading applications...'),
            error: (e, _) => ErrorState(message: e.toString(), onRetry: () => ref.invalidate(applicationListProvider)),
            data: (list) {
              final filtered = list.where((a) {
                final matchState = _filterState == null || a.state == _filterState;
                final matchSearch = _search.isEmpty ||
                    (a.borrowerProfile?.companyName.toLowerCase().contains(_search) ?? false) ||
                    (a.referenceNumber?.toLowerCase().contains(_search) ?? false);
                return matchState && matchSearch;
              }).toList();

              if (filtered.isEmpty) return const Center(child: Text('No applications found'));

              return RefreshIndicator(
                onRefresh: () => ref.refresh(applicationListProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, i) => _AppCard(app: filtered[i]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

class _AppCard extends StatelessWidget {
  const _AppCard({required this.app});
  final CreditApplication app;

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(symbol: '${app.currency ?? ""} ', decimalDigits: 0);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/applications/${app.id}'),
        child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(app.borrowerProfile?.companyName ?? app.id,
                style: const TextStyle(fontWeight: FontWeight.w600))),
            StateBadge(state: app.state),
          ]),
          if (app.referenceNumber != null) ...[
            const SizedBox(height: 2),
            Text(app.referenceNumber!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
          const SizedBox(height: 6),
          Row(children: [
            Text(app.productType ?? '-', style: const TextStyle(fontSize: 13)),
            const Spacer(),
            if (app.totalFacilityAmount != null)
              Text(fmt.format(app.totalFacilityAmount), style: const TextStyle(fontWeight: FontWeight.w500)),
          ]),
        ])),
      ),
    );
  }
}
```

- [ ] **Step 3: Write application detail screen**

```dart
// cwc_mobile/lib/staff/applications/application_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/error_state.dart';
import '../../core/widgets/loading_overlay.dart';
import '../../core/widgets/state_badge.dart';
import 'application_provider.dart';

class ApplicationDetailScreen extends ConsumerWidget {
  const ApplicationDetailScreen({super.key, required this.applicationId});
  final String applicationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appAsync = ref.watch(applicationDetailProvider(applicationId));

    return Scaffold(
      appBar: AppBar(title: const Text('Application')),
      body: appAsync.when(
        loading: () => const LoadingOverlay(message: 'Loading application...'),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (app) {
          final fmt = NumberFormat.currency(symbol: '${app.currency ?? ""} ', decimalDigits: 0);
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              Expanded(child: Text(app.borrowerProfile?.companyName ?? app.id,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))),
              StateBadge(state: app.state),
            ]),
            if (app.referenceNumber != null) ...[
              const SizedBox(height: 4),
              Text(app.referenceNumber!, style: const TextStyle(color: AppColors.textSecondary)),
            ],
            const Divider(height: 24),
            _Section('Loan Details', [
              _Row('Product', app.productType ?? '-'),
              _Row('Amount', app.totalFacilityAmount != null ? fmt.format(app.totalFacilityAmount) : '-'),
              _Row('Currency', app.currency ?? '-'),
            ]),
            const SizedBox(height: 16),
            _Section('Assigned Team', [
              _Row('Relationship Mgr', app.rmUser?.fullName ?? 'Unassigned'),
              _Row('Analyst', app.analystUser?.fullName ?? 'Unassigned'),
            ]),
            const SizedBox(height: 16),
            _Section('Timeline', [
              _Row('Created', app.createdAt != null ? DateFormat('dd MMM yyyy').format(app.createdAt!) : '-'),
              _Row('Last Updated', app.updatedAt != null ? DateFormat('dd MMM yyyy').format(app.updatedAt!) : '-'),
            ]),
          ]);
        },
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.title, this.rows);
  final String title;
  final List<Widget> rows;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary, fontSize: 12)),
    const SizedBox(height: 8),
    Card(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(children: rows))),
  ]);
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(children: [
      SizedBox(width: 130, child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
      Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
    ]),
  );
}
```

- [ ] **Step 4: Wire into router**

In `cwc_mobile/lib/staff/router.dart`:

```dart
import '../staff/applications/application_list_screen.dart';
import '../staff/applications/application_detail_screen.dart';
// ...
GoRoute(
  path: '/applications',
  builder: (_, __) => const ApplicationListScreen(),
  routes: [
    GoRoute(
      path: ':id',
      builder: (_, s) => ApplicationDetailScreen(applicationId: s.pathParameters['id']!),
    ),
  ],
),
```

- [ ] **Step 5: Run Flutter analyze**

```bash
cd cwc_mobile && flutter analyze
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add cwc_mobile/lib/staff/applications/
git commit -m "feat(mobile/staff): add Application List and Detail screens with search and state filter"
```

---

## Task 6: Push Notification Handling (Staff)

**Files:**
- Create: `cwc_mobile/lib/core/notifications/push_handler.dart`
- Modify: `cwc_mobile/lib/main_staff.dart`

- [ ] **Step 1: Write push handler**

```dart
// cwc_mobile/lib/core/notifications/push_handler.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

@pragma('vm:entry-point')
Future<void> handleBackgroundMessage(RemoteMessage message) async {
  // Background handler — minimal processing only
}

class PushHandler {
  static Future<void> init(BuildContext context, GoRouter router) async {
    await FirebaseMessaging.instance.requestPermission();

    // Foreground messages
    FirebaseMessaging.onMessage.listen((msg) {
      final type = msg.data['type'] as String?;
      final body = msg.notification?.body ?? '';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(body),
          action: type == 'APPROVAL_PENDING'
              ? SnackBarAction(label: 'View', onPressed: () => router.go('/approvals'))
              : null,
        ),
      );
    });

    // App opened from notification (background)
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      _navigate(msg.data, router);
    });

    // App opened from terminated state
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) _navigate(initial.data, router);

    FirebaseMessaging.onBackgroundMessage(handleBackgroundMessage);
  }

  static void _navigate(Map<String, dynamic> data, GoRouter router) {
    final type = data['type'] as String?;
    final appId = data['applicationId'] as String?;
    if (type == 'APPROVAL_PENDING') router.go('/approvals');
    if (type == 'STATE_CHANGE' && appId != null) router.go('/applications/$appId');
  }
}
```

- [ ] **Step 2: Initialize in main_staff.dart**

In `cwc_mobile/lib/main_staff.dart`, update `main()`:

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlavorConfig.instance = const FlavorConfig(
    flavor: Flavor.staff,
    appName: 'CWC Credit',
    baseUrl: String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000/api/v1'),
  );

  await Firebase.initializeApp();

  runApp(const ProviderScope(child: StaffApp()));
}
```

Push handler is initialized from `StaffApp` after router is available — add to `StaffApp.build`:

```dart
// In staff/app.dart, add after MaterialApp.router builds:
// Inside ConsumerWidget build, after getting router:
// (Push init needs context — use a NavigatorObserver or builder callback)
// Simplest: add to main_staff.dart using a post-frame callback after runApp
```

Add to `main_staff.dart` after `runApp`:
```dart
// Push init deferred until first frame so context is available
// This is handled inside StaffApp's initState via a GlobalKey<NavigatorState>
```

Note: Exact push initialization wiring depends on whether you use a GlobalKey navigator or go_router's navigatorKey. Add `navigatorKey` to `GoRouter` config in `staff/router.dart`:

```dart
final _rootNavigatorKey = GlobalKey<NavigatorState>();

final staffRouterProvider = Provider<GoRouter>((ref) {
  // ...
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    // ...
  );
});
```

Then in `StaffApp`:
```dart
@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    final router = ref.read(staffRouterProvider);
    PushHandler.init(context, router);
  });
}
// (change StaffApp to ConsumerStatefulWidget)
```

- [ ] **Step 3: Add Riverpod notification stream provider**

Create `cwc_mobile/lib/core/notifications/notification_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class AppNotification {
  final String type;
  final Map<String, String> data;
  const AppNotification({required this.type, required this.data});
}

/// Exposes foreground FCM messages as a reactive Riverpod stream.
/// Screens watch this to auto-refresh when a relevant push arrives —
/// no manual SnackBar wiring needed for data invalidation.
final notificationStreamProvider = StreamProvider<AppNotification>((ref) {
  return FirebaseMessaging.onMessage.map((msg) => AppNotification(
    type: msg.data['type'] as String? ?? 'UNKNOWN',
    data: Map<String, String>.from(msg.data),
  ));
});
```

- [ ] **Step 4: Wire auto-refresh into Approval Inbox**

In `cwc_mobile/lib/staff/approvals/approval_inbox_screen.dart`, inside `build()` before the `return Scaffold(...)`, add:

```dart
// Auto-refresh the approval list when a push notification arrives
ref.listen(notificationStreamProvider, (_, next) {
  next.whenData((n) {
    if (n.type == 'APPROVAL_PENDING' || n.type == 'APPROVAL_DECISION') {
      ref.invalidate(approvalInboxProvider);
    }
  });
});
```

Add the import at the top of the file:
```dart
import '../../core/notifications/notification_provider.dart';
```

Note: `PushHandler.init()` still runs on startup (Step 2) for navigation-on-tap and background/terminated state handling. The `notificationStreamProvider` handles foreground data refresh reactively — both coexist without conflict.

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/core/notifications/ cwc_mobile/lib/main_staff.dart cwc_mobile/lib/staff/app.dart cwc_mobile/lib/staff/router.dart cwc_mobile/lib/staff/approvals/approval_inbox_screen.dart
git commit -m "feat(mobile/staff): add push handler + Riverpod notification stream for reactive inbox refresh"
```

---

## P2 Complete — Handoff to P3

At this point the staff app has:
- ✅ Login with biometric auto-auth
- ✅ Approval Inbox with full APPROVE/REJECT/DEFER/RETURN actions
- ✅ Committee Voting with agenda carousel and vote submission
- ✅ Dashboard with pipeline KPIs
- ✅ Application List with search + state filter
- ✅ Application Detail (read-only)
- ✅ Push notification routing

**Next:** `docs/superpowers/plans/2026-06-05-flutter-credit-p3-borrower-mvp.md`

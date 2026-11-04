
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

// -----------------------------------------
// Common Response Helper
// -----------------------------------------

function expenseResponse($status, $message, $httpCode = 200, $data = null)
{
    http_response_code($httpCode);

    $response = [
        "status" => $status,
        "message" => $message
    ];

    if ($data !== null) {
        $response["data"] = $data;
    }

    echo json_encode($response);
    exit;
}

// -----------------------------------------
// Authentication
// -----------------------------------------

if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    expenseResponse("error", "Authentication required.", 401);
}

$currentUserId = (int) $_SESSION["user_id"];
$currentRole = $_SESSION["role"];

$isAdmin = ($currentRole === "ADMIN");

if (!$isAdmin && $currentRole !== "MEMBER") {
    expenseResponse("error", "Access denied.", 403);
}

// -----------------------------------------
// Helper: Validate Date
// -----------------------------------------

function isValidExpenseDate($date)
{
    if (!is_string($date)) {
        return false;
    }

    $parsed = DateTime::createFromFormat("!Y-m-d", $date);

    return $parsed && $parsed->format("Y-m-d") === $date;
}

// -----------------------------------------
// Helper: Validate Expense Data
// -----------------------------------------

function validateExpenseData($db, $data)
{
    $categoryId = (int) ($data["category_id"] ?? 0);

    $paymentSource = strtoupper(
        trim((string) ($data["payment_source"] ?? ""))
    );

    $payerId = isset($data["paid_by_user_id"])
        ? (int) $data["paid_by_user_id"]
        : 0;

    $expenseDate = $data["expense_date"] ?? "";

    $amount = $data["amount"] ?? null;

    $description = trim(
        (string) ($data["description"] ?? "")
    );

    if ($categoryId <= 0) {
        expenseResponse("error", "Select a valid expense category.", 400);
    }

    if (!in_array($paymentSource, ["MEMBER", "CASHBOX"], true)) {
        expenseResponse("error", "Invalid payment source.", 400);
    }

    if (!is_numeric($amount)) {
        expenseResponse("error", "Enter a valid expense amount.", 400);
    }

    $amount = (float) $amount;

    if (!is_finite($amount) || $amount <= 0 || $amount > 9999999999.99) {
        expenseResponse("error", "Expense amount must be greater than zero.", 400);
    }

    if (!isValidExpenseDate($expenseDate)) {
        expenseResponse("error", "Invalid expense date.", 400);
    }

    if (strlen($description) > 255) {
        expenseResponse("error", "Description cannot exceed 255 characters.", 400);
    }

    if ($paymentSource === "MEMBER" && $payerId <= 0) {
        expenseResponse("error", "Select the member who paid.", 400);
    }

    if ($paymentSource === "CASHBOX") {
        $payerId = null;
    }

    // Check active category
    $categoryStmt = $db->prepare("
        SELECT category_id
        FROM expense_categories
        WHERE category_id = :category_id
          AND is_active = 1
        LIMIT 1
    ");

    $categoryStmt->execute([
        ":category_id" => $categoryId
    ]);

    if (!$categoryStmt->fetch()) {
        expenseResponse("error", "Selected category is inactive or invalid.", 400);
    }

    // Check payer
    if ($paymentSource === "MEMBER") {

        $payerStmt = $db->prepare("
            SELECT user_id
            FROM users
            WHERE user_id = :payer_id
              AND role = 'MEMBER'
              AND account_status = 'ACTIVE'
            LIMIT 1
        ");

        $payerStmt->execute([
            ":payer_id" => $payerId
        ]);

        if (!$payerStmt->fetch()) {
            expenseResponse("error", "Selected paying member is invalid.", 400);
        }
    }

    return [
        "category_id" => $categoryId,
        "paid_by_user_id" => $payerId,
        "payment_source" => $paymentSource,
        "expense_date" => $expenseDate,
        "amount" => number_format($amount, 2, ".", ""),
        "description" => $description
    ];
}

// -----------------------------------------
// Read JSON Request
// -----------------------------------------

$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    $input = [];
}

try {

    $database = new Database();
    $db = $database->connect();

    $method = $_SERVER["REQUEST_METHOD"];

    // =====================================
    // GET: View Expenses
    // =====================================

    if ($method === "GET") {

        $monthId = isset($_GET["month_id"])
            ? (int) $_GET["month_id"]
            : 0;

        $date = $_GET["date"] ?? null;

        $status = isset($_GET["status"])
            ? strtoupper(trim($_GET["status"]))
            : null;

        if (
            $status !== null &&
            !in_array(
                $status,
                ["PENDING", "VERIFIED", "FLAGGED", "REJECTED"],
                true
            )
        ) {
            expenseResponse("error", "Invalid expense status.", 400);
        }

        $sql = "
            SELECT
                e.expense_id,
                e.category_id,
                ec.category_name,
                ec.allocation_method,
                e.paid_by_user_id,
                payer.full_name AS paid_by_name,
                e.payment_source,
                e.expense_date,
                e.amount,
                e.description,
                e.receipt_path,
                e.status,
                e.entered_by,
                submitter.full_name AS entered_by_name,
                e.reviewed_by,
                reviewer.full_name AS reviewed_by_name,
                e.reviewed_at,
                e.created_at,
                e.updated_at

            FROM expenses e

            INNER JOIN expense_categories ec
                ON e.category_id = ec.category_id

            LEFT JOIN users payer
                ON e.paid_by_user_id = payer.user_id

            LEFT JOIN users submitter
                ON e.entered_by = submitter.user_id

            LEFT JOIN users reviewer
                ON e.reviewed_by = reviewer.user_id
        ";

        $conditions = [];
        $params = [];

        if ($monthId > 0) {

            $sql .= "
                INNER JOIN months m
                    ON e.expense_date BETWEEN m.start_date AND m.end_date
            ";

            $conditions[] = "m.month_id = :month_id";
            $params[":month_id"] = $monthId;

        } elseif ($date !== null) {

            if (!isValidExpenseDate($date)) {
                expenseResponse("error", "Invalid date format.", 400);
            }

            $conditions[] = "e.expense_date = :expense_date";
            $params[":expense_date"] = $date;

        } else {

            expenseResponse(
                "error",
                "Provide month_id or date to view expenses.",
                400
            );
        }

        if ($status !== null) {
            $conditions[] = "e.status = :status";
            $params[":status"] = $status;
        }

        $sql .= "
            WHERE " . implode(" AND ", $conditions) . "
            ORDER BY e.expense_date DESC, e.expense_id DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        expenseResponse(
            "success",
            "Expense records retrieved successfully.",
            200,
            $stmt->fetchAll()
        );
    }

    // =====================================
    // POST: Create Expense
    // =====================================

    if ($method === "POST") {

        $entries = $input["entries"] ?? [];

        // Accept single expense also
        if (isset($input["category_id"])) {
            $entries = [$input];
        }

        if (
            !is_array($entries) ||
            count($entries) < 1 ||
            count($entries) > 50
        ) {
            expenseResponse(
                "error",
                "Submit between 1 and 50 expense entries.",
                400
            );
        }

        $db->beginTransaction();

        $insertStmt = $db->prepare("
            INSERT INTO expenses (
                category_id,
                paid_by_user_id,
                payment_source,
                expense_date,
                amount,
                description,
                status,
                entered_by
            ) VALUES (
                :category_id,
                :paid_by_user_id,
                :payment_source,
                :expense_date,
                :amount,
                :description,
                'PENDING',
                :entered_by
            )
        ");

        $insertedIds = [];

        $monthCheck = $db->prepare("
            SELECT month_id
            FROM months
            WHERE :expense_date BETWEEN start_date AND end_date
              AND status = 'OPEN'
            LIMIT 1
        ");

        foreach ($entries as $entry) {

            if (!is_array($entry)) {
                $db->rollBack();
                expenseResponse("error", "Invalid expense entry format.", 400);
            }

            $expense = validateExpenseData($db, $entry);

            $monthCheck->execute([
                ":expense_date" => $expense["expense_date"]
            ]);

            if (!$monthCheck->fetch()) {
                $db->rollBack();

                expenseResponse(
                    "error",
                    "No open accounting month for this expense date.",
                    400
                );
            }

            $insertStmt->execute([
                ":category_id" => $expense["category_id"],
                ":paid_by_user_id" => $expense["paid_by_user_id"],
                ":payment_source" => $expense["payment_source"],
                ":expense_date" => $expense["expense_date"],
                ":amount" => $expense["amount"],
                ":description" => $expense["description"],
                ":entered_by" => $currentUserId
            ]);

            $insertedIds[] = (int) $db->lastInsertId();
        }

        $db->commit();

        expenseResponse(
            "success",
            "Expense entries submitted for Admin review.",
            201,
            [
                "expense_ids" => $insertedIds
            ]
        );
    }

    // =====================================
    // PUT: Update or Review Expense
    // =====================================

    if ($method === "PUT") {

        $expenseId = (int) ($input["expense_id"] ?? 0);

        if ($expenseId <= 0) {
            expenseResponse("error", "Valid expense_id is required.", 400);
        }

        $db->beginTransaction();

        $findStmt = $db->prepare("
            SELECT *
            FROM expenses
            WHERE expense_id = :expense_id
            FOR UPDATE
        ");

        $findStmt->execute([
            ":expense_id" => $expenseId
        ]);

        $existing = $findStmt->fetch();

        if (!$existing) {
            $db->rollBack();
            expenseResponse("error", "Expense entry not found.", 404);
        }

        // Check month status
        $monthCheck = $db->prepare("
            SELECT status
            FROM months
            WHERE :expense_date BETWEEN start_date AND end_date
            LIMIT 1
        ");

        $monthCheck->execute([
            ":expense_date" => $existing["expense_date"]
        ]);

        $month = $monthCheck->fetch();

        if (!$month || $month["status"] !== "OPEN") {
            $db->rollBack();
            expenseResponse("error", "This accounting month is closed.", 403);
        }

        $action = $input["action"] ?? "update";

        // ---------------------------------
        // Admin Review
        // ---------------------------------

        if ($action === "review") {

            if (!$isAdmin) {
                $db->rollBack();
                expenseResponse("error", "Only Admin can review expenses.", 403);
            }

            $newStatus = strtoupper(
                (string) ($input["status"] ?? "")
            );

            if (
                !in_array(
                    $newStatus,
                    ["VERIFIED", "FLAGGED", "REJECTED"],
                    true
                )
            ) {
                $db->rollBack();
                expenseResponse("error", "Invalid review status.", 400);
            }

            $reviewStmt = $db->prepare("
                UPDATE expenses
                SET
                    status = :status,
                    reviewed_by = :reviewed_by,
                    reviewed_at = NOW()
                WHERE expense_id = :expense_id
            ");

            $reviewStmt->execute([
                ":status" => $newStatus,
                ":reviewed_by" => $currentUserId,
                ":expense_id" => $expenseId
            ]);

            $db->commit();

            expenseResponse(
                "success",
                "Expense review completed.",
                200,
                [
                    "expense_id" => $expenseId,
                    "status" => $newStatus
                ]
            );
        }

        // ---------------------------------
        // Normal Edit Permission
        // ---------------------------------

        $canEdit = $isAdmin || (
            (int) $existing["entered_by"] === $currentUserId &&
            $existing["status"] === "PENDING"
        );

        if (!$canEdit) {
            $db->rollBack();

            expenseResponse(
                "error",
                "You cannot edit this expense entry.",
                403
            );
        }

        // Existing or new values
        $updatedData = [
            "category_id" => $input["category_id"] ?? $existing["category_id"],

            "paid_by_user_id" => $input["paid_by_user_id"] ?? $existing["paid_by_user_id"],

            "payment_source" => $input["payment_source"] ?? $existing["payment_source"],

            "expense_date" => $input["expense_date"] ?? $existing["expense_date"],

            "amount" => $input["amount"] ?? $existing["amount"],

            "description" => $input["description"] ?? $existing["description"]
        ];

        $expense = validateExpenseData($db, $updatedData);

        // Check new month
        $newMonthCheck = $db->prepare("
            SELECT month_id
            FROM months
            WHERE :expense_date BETWEEN start_date AND end_date
              AND status = 'OPEN'
            LIMIT 1
        ");

        $newMonthCheck->execute([
            ":expense_date" => $expense["expense_date"]
        ]);

        if (!$newMonthCheck->fetch()) {
            $db->rollBack();

            expenseResponse(
                "error",
                "No open accounting month for this expense date.",
                400
            );
        }

        $updateStmt = $db->prepare("
            UPDATE expenses
            SET
                category_id = :category_id,
                paid_by_user_id = :paid_by_user_id,
                payment_source = :payment_source,
                expense_date = :expense_date,
                amount = :amount,
                description = :description
            WHERE expense_id = :expense_id
        ");

        $updateStmt->execute([
            ":category_id" => $expense["category_id"],
            ":paid_by_user_id" => $expense["paid_by_user_id"],
            ":payment_source" => $expense["payment_source"],
            ":expense_date" => $expense["expense_date"],
            ":amount" => $expense["amount"],
            ":description" => $expense["description"],
            ":expense_id" => $expenseId
        ]);

        $db->commit();

        expenseResponse(
            "success",
            "Expense entry updated successfully.",
            200,
            [
                "expense_id" => $expenseId
            ]
        );
    }

    // =====================================
    // Unsupported Method
    // =====================================

    expenseResponse("error", "Method not allowed.", 405);

} catch (PDOException $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log($e->getMessage());

    expenseResponse(
        "error",
        "A database error occurred.",
        500
    );

} catch (Throwable $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log($e->getMessage());

    expenseResponse(
        "error",
        "An unexpected server error occurred.",
        500
    );
}

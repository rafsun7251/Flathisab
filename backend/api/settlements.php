
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

function settlementResponse($status, $message, $code = 200, $data = null)
{
    http_response_code($code);

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

function settlementInput()
{
    $data = json_decode(file_get_contents("php://input"), true);
    return is_array($data) ? $data : [];
}

// Authentication
if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    settlementResponse("error", "Authentication required.", 401);
}

$userId = (int) $_SESSION["user_id"];
$role = strtoupper($_SESSION["role"]);
$isAdmin = ($role === "ADMIN");

try {

    $database = new Database();
    $db = $database->connect();

    $method = $_SERVER["REQUEST_METHOD"];

    // =========================================
    // GET: View Monthly Settlement
    // =========================================

    if ($method === "GET") {

        $monthId = (int) ($_GET["month_id"] ?? 0);

        if ($monthId <= 0) {
            settlementResponse("error", "Valid month ID required.", 400);
        }

        $sql = "
            SELECT
                s.*,
                u.full_name AS member_name,
                u.username
            FROM monthly_settlements s
            INNER JOIN users u
                ON u.user_id = s.member_id
            WHERE s.month_id = :month_id
        ";

        if (!$isAdmin) {
            $sql .= " AND s.member_id = :user_id";
        }

        $sql .= " ORDER BY u.full_name ASC";

        $stmt = $db->prepare($sql);

        $params = [
            ":month_id" => $monthId
        ];

        if (!$isAdmin) {
            $params[":user_id"] = $userId;
        }

        $stmt->execute($params);

        settlementResponse(
            "success",
            "Settlement records retrieved successfully.",
            200,
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    // =========================================
    // POST: Calculate Settlement
    // =========================================

    if ($method === "POST") {

        if (!$isAdmin) {
            settlementResponse(
                "error",
                "Only Admin can calculate settlement.",
                403
            );
        }

        $input = settlementInput();

        $monthId = (int) ($input["month_id"] ?? 0);

        if ($monthId <= 0) {
            settlementResponse("error", "Valid month ID required.", 400);
        }

        // Find month
        $monthStmt = $db->prepare("
            SELECT month_id, start_date, end_date, status
            FROM months
            WHERE month_id = :month_id
            LIMIT 1
        ");

        $monthStmt->execute([
            ":month_id" => $monthId
        ]);

        $month = $monthStmt->fetch(PDO::FETCH_ASSOC);

        if (!$month) {
            settlementResponse("error", "Month not found.", 404);
        }

        if ($month["status"] !== "OPEN") {
            settlementResponse(
                "error",
                "Cannot calculate a closed month.",
                400
            );
        }

        $startDate = $month["start_date"];
        $endDate = $month["end_date"];

        // =====================================
        // Find active members
        // =====================================

        $members = $db->query("
            SELECT user_id, full_name
            FROM users
            WHERE role = 'MEMBER'
              AND account_status = 'ACTIVE'
            ORDER BY user_id
        ")->fetchAll(PDO::FETCH_ASSOC);

        $memberCount = count($members);

        if ($memberCount === 0) {
            settlementResponse(
                "error",
                "No active members found.",
                400
            );
        }

        // =====================================
        // 1. Total verified food/bazar expense
        // =====================================

        $foodStmt = $db->prepare("
            SELECT COALESCE(SUM(e.amount), 0)
            FROM expenses e
            INNER JOIN expense_categories c
                ON c.category_id = e.category_id
            WHERE e.expense_date BETWEEN :start_date AND :end_date
              AND e.status = 'VERIFIED'
              AND c.allocation_method = 'FOOD_PER_MEAL'
        ");

        $foodStmt->execute([
            ":start_date" => $startDate,
            ":end_date" => $endDate
        ]);

        $foodExpenseTotal = (float) $foodStmt->fetchColumn();

        // =====================================
        // 2. Total verified meal quantity
        // =====================================

        $mealStmt = $db->prepare("
            SELECT COALESCE(SUM(quantity + guest_quantity), 0)
            FROM meal_entries
            WHERE meal_date BETWEEN :start_date AND :end_date
              AND status = 'VERIFIED'
        ");

        $mealStmt->execute([
            ":start_date" => $startDate,
            ":end_date" => $endDate
        ]);

        $totalMealQuantity = (float) $mealStmt->fetchColumn();

        if ($totalMealQuantity <= 0 && $foodExpenseTotal > 0) {
            settlementResponse(
                "error",
                "Food expenses exist but no verified meals were found.",
                400
            );
        }

        // Meal Rate
        $mealRate = $totalMealQuantity > 0
            ? $foodExpenseTotal / $totalMealQuantity
            : 0;

        // =====================================
        // 3. Total verified fixed expenses
        // =====================================

        $fixedStmt = $db->prepare("
            SELECT COALESCE(SUM(e.amount), 0)
            FROM expenses e
            INNER JOIN expense_categories c
                ON c.category_id = e.category_id
            WHERE e.expense_date BETWEEN :start_date AND :end_date
              AND e.status = 'VERIFIED'
              AND c.allocation_method = 'EQUAL_SPLIT'
        ");

        $fixedStmt->execute([
            ":start_date" => $startDate,
            ":end_date" => $endDate
        ]);

        $fixedExpenseTotal = (float) $fixedStmt->fetchColumn();

        // Divide fixed expenses equally among active members
        $fixedExpenseShare = $fixedExpenseTotal / $memberCount;

        // =====================================
        // 4. Member-wise queries
        // =====================================

        // Member meal quantity
        $memberMealStmt = $db->prepare("
            SELECT COALESCE(SUM(quantity + guest_quantity), 0)
            FROM meal_entries
            WHERE member_id = :member_id
              AND meal_date BETWEEN :start_date AND :end_date
              AND status = 'VERIFIED'
        ");

        // Meal and Utility Deposit Allocation
        $depositStmt = $db->prepare("
            SELECT

                COALESCE(SUM(
                    CASE
                        WHEN da.allocation_type = 'MEAL_FUND'
                            THEN da.amount

                        WHEN d.deposit_type = 'MEAL_FUND'
                             AND da.allocation_id IS NULL
                            THEN d.amount

                        ELSE 0
                    END
                ), 0) AS meal_deposit,

                COALESCE(SUM(
                    CASE
                        WHEN da.allocation_type = 'UTILITY_FUND'
                            THEN da.amount
                        ELSE 0
                    END
                ), 0) AS utility_deposit

            FROM deposits d

            LEFT JOIN deposit_allocations da
                ON da.deposit_id = d.deposit_id

            WHERE d.member_id = :member_id
              AND d.deposit_date BETWEEN :start_date AND :end_date
              AND d.status = 'VERIFIED'
        ");

        // Verified expenses paid personally by member
        $creditStmt = $db->prepare("
            SELECT COALESCE(SUM(amount), 0)
            FROM expenses
            WHERE paid_by_user_id = :member_id
              AND payment_source = 'MEMBER'
              AND expense_date BETWEEN :start_date AND :end_date
              AND status = 'VERIFIED'
        ");

        // Find existing settlement
        $findSettlementStmt = $db->prepare("
            SELECT settlement_id
            FROM monthly_settlements
            WHERE month_id = :month_id
              AND member_id = :member_id
            LIMIT 1
        ");

        // =====================================
        // 5. INSERT Settlement
        // =====================================

        $insertStmt = $db->prepare("
            INSERT INTO monthly_settlements (
                month_id,
                member_id,
                meal_quantity,
                food_expense_total,
                meal_rate,
                meal_cost,
                fixed_expense_share,
                meal_deposit,
                utility_deposit,
                deposits_total,
                expenses_paid_credit,
                opening_balance,
                final_balance,
                calculated_at,
                calculated_by
            )
            VALUES (
                :month_id,
                :member_id,
                :meal_quantity,
                :food_expense_total,
                :meal_rate,
                :meal_cost,
                :fixed_expense_share,
                :meal_deposit,
                :utility_deposit,
                :deposits_total,
                :expenses_paid_credit,
                0,
                :final_balance,
                CURRENT_TIMESTAMP,
                :calculated_by
            )
        ");

        // =====================================
        // 6. UPDATE Settlement
        // =====================================

        $updateStmt = $db->prepare("
            UPDATE monthly_settlements
            SET
                meal_quantity = :meal_quantity,
                food_expense_total = :food_expense_total,
                meal_rate = :meal_rate,
                meal_cost = :meal_cost,
                fixed_expense_share = :fixed_expense_share,
                meal_deposit = :meal_deposit,
                utility_deposit = :utility_deposit,
                deposits_total = :deposits_total,
                expenses_paid_credit = :expenses_paid_credit,
                opening_balance = 0,
                final_balance = :final_balance,
                calculated_at = CURRENT_TIMESTAMP,
                calculated_by = :calculated_by
            WHERE settlement_id = :settlement_id
        ");

        // =====================================
        // 7. Calculate each member
        // =====================================

        $db->beginTransaction();

        $results = [];

        foreach ($members as $member) {

            $memberId = (int) $member["user_id"];

            $params = [
                ":member_id" => $memberId,
                ":start_date" => $startDate,
                ":end_date" => $endDate
            ];

            // Member meal quantity
            $memberMealStmt->execute($params);

            $mealQuantity = (float) $memberMealStmt->fetchColumn();

            // Member meal cost
            $mealCost = $mealQuantity * $mealRate;

            // Fetch both deposit allocations
            $depositStmt->execute($params);

            $depositData = $depositStmt->fetch(PDO::FETCH_ASSOC);

            $mealDeposit = (float) (
                $depositData["meal_deposit"] ?? 0
            );

            $utilityDeposit = (float) (
                $depositData["utility_deposit"] ?? 0
            );

            // Total allocated deposit
            $depositsTotal = $mealDeposit + $utilityDeposit;

            // Member-paid verified expenses
            $creditStmt->execute($params);

            $expensesPaidCredit = (float) $creditStmt->fetchColumn();

            // =====================================
            // Final Balance
            // =====================================

            // Opening Balance is excluded.
            //
            // Positive = Member must pay
            // Negative = Member receives money

            $finalBalance = round(
                $mealCost
                + $fixedExpenseShare
                - $depositsTotal
                - $expensesPaidCredit,
                2
            );

            // =====================================
            // Prepare database values
            // =====================================

            $values = [
                ":meal_quantity" => $mealQuantity,
                ":food_expense_total" => round($foodExpenseTotal, 2),
                ":meal_rate" => round($mealRate, 4),
                ":meal_cost" => round($mealCost, 2),
                ":fixed_expense_share" => round($fixedExpenseShare, 2),
                ":meal_deposit" => round($mealDeposit, 2),
                ":utility_deposit" => round($utilityDeposit, 2),
                ":deposits_total" => round($depositsTotal, 2),
                ":expenses_paid_credit" => round($expensesPaidCredit, 2),
                ":final_balance" => $finalBalance,
                ":calculated_by" => $userId
            ];

            // Check existing settlement
            $findSettlementStmt->execute([
                ":month_id" => $monthId,
                ":member_id" => $memberId
            ]);

            $existingId = $findSettlementStmt->fetchColumn();

            if ($existingId) {

                $updateStmt->execute(
                    $values + [
                        ":settlement_id" => (int) $existingId
                    ]
                );

            } else {

                $insertStmt->execute(
                    $values + [
                        ":month_id" => $monthId,
                        ":member_id" => $memberId
                    ]
                );
            }

            // Response data
            $results[] = [
                "member_id" => $memberId,
                "member_name" => $member["full_name"],
                "meal_quantity" => $mealQuantity,
                "meal_cost" => round($mealCost, 2),
                "meal_rate" => round($mealRate, 4),
                "fixed_expense_share" => round($fixedExpenseShare, 2),
                "meal_deposit" => round($mealDeposit, 2),
                "utility_deposit" => round($utilityDeposit, 2),
                "deposits_total" => round($depositsTotal, 2),
                "expenses_paid_credit" => round($expensesPaidCredit, 2),
                "final_balance" => $finalBalance
            ];
        }

        $db->commit();

        settlementResponse(
            "success",
            "Monthly settlement calculated successfully.",
            200,
            [
                "month_id" => $monthId,
                "total_meal_quantity" => $totalMealQuantity,
                "food_expense_total" => round($foodExpenseTotal, 2),
                "meal_rate" => round($mealRate, 4),
                "fixed_expense_total" => round($fixedExpenseTotal, 2),
                "fixed_expense_share" => round($fixedExpenseShare, 2),
                "members" => $results
            ]
        );
    }

    settlementResponse("error", "Method not allowed.", 405);

} catch (Throwable $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log($e->getMessage());

    settlementResponse(
        "error",
        "Settlement operation failed. Check server error log.",
        500
    );
}

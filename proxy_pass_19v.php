<?php
// Smart Sender API Proxy v4
// SHUKAJ - STVORY - PEREVIRJ KONTAKT - POVISY

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$token = 'CgWmWPRcMKM1bvjVu0V0MLiGw8dT6FNsmvNsBX5CA0rBII83vAC2wISEYxGG';

function ssApi($method, $url, $token, $body = null) {
    $ch = curl_init($url);
    $headers = [
        'Authorization: Bearer ' . $token,
        'Accept: application/json'
    ];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => $headers
    ];
    if ($method === 'POST') {
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_HTTPHEADER] = $headers;
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = $body ? json_encode($body) : '{}';
    }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    $info = [
        'httpCode' => curl_getinfo($ch, CURLINFO_HTTP_CODE),
        'curlError' => curl_error($ch),
        'raw' => $res,
        'data' => json_decode($res, true)
    ];
    curl_close($ch);
    return $info;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['error' => 'Nevalidnij JSON. Otrimano: ' . file_get_contents('php://input')]);
    exit;
}

$userId  = isset($input['userId'])  ? trim($input['userId'])  : '';
$tagName = isset($input['tagName']) ? trim($input['tagName']) : '';

if (empty($userId)) { echo json_encode(['error' => 'userId porozhnij']); exit; }
if (empty($tagName)) { echo json_encode(['error' => 'tagName porozhnij']); exit; }

// Funktsiya poshuku tegu po vsih storinkah
function findTagByName($tagName, $token) {
    $page = 1;
    $maxPages = 10; // zahyst vid neskinchennoho tsyklu
    do {
        $r = ssApi('GET', 'https://api.smartsender.com/v1/tags?term=' . urlencode($tagName) . '&page=' . $page . '&limitation=50', $token);
        if ($r['curlError'] || $r['httpCode'] < 200 || $r['httpCode'] >= 300) break;

        $collection = [];
        if (isset($r['data']['collection'])) $collection = $r['data']['collection'];
        elseif (isset($r['data']['data'])) $collection = $r['data']['data'];
        elseif (is_array($r['data'])) $collection = $r['data'];

        foreach ($collection as $tag) {
            if (isset($tag['name']) && strtolower(trim($tag['name'])) === strtolower(trim($tagName))) {
                return $tag['id'];
            }
        }

        $totalPages = isset($r['data']['cursor']['pages']) ? (int)$r['data']['cursor']['pages'] : 1;
        $page++;
    } while ($page <= $totalPages && $page <= $maxPages);

    return null;
}

// KROK 1: SHUKAJEMO teg
$tagId = findTagByName($tagName, $token);
$step = 'KROK 1: Poshuk tegu';

// KROK 2: Yakshcho ne znajshly - STVORYUJEMO
if (!$tagId) {
    $step = 'KROK 2: Stvorennya tegu';
    $r2 = ssApi('POST', 'https://api.smartsender.com/v1/tags', $token, [
        'name' => $tagName,
        'color' => 'FF0000'
    ]);

    if ($r2['curlError']) { echo json_encode(['error' => $step . ' cURL: ' . $r2['curlError']]); exit; }

    if (isset($r2['data']['id'])) {
        $tagId = $r2['data']['id'];
    } elseif ($r2['httpCode'] === 422 || $r2['httpCode'] === 409) {
        usleep(500000);
        $tagId = findTagByName($tagName, $token);
        if (!$tagId) {
            echo json_encode(['error' => $step . ' Teg isnuje ale ne znajdeno na zhodnij storintsi']);
            exit;
        }
    } else {
        $msg = isset($r2['data']['message']) ? $r2['data']['message'] : $r2['raw'];
        echo json_encode(['error' => $step . ' HTTP ' . $r2['httpCode'] . ': ' . $msg]);
        exit;
    }
}

// KROK 3: PEREVIRYAJEMO kontakt
$step = 'KROK 3: Perevirka kontaktu';
$r3 = ssApi('GET', 'https://api.smartsender.com/v1/contacts/' . urlencode($userId), $token);

if ($r3['curlError']) { echo json_encode(['error' => $step . ' cURL: ' . $r3['curlError']]); exit; }
if ($r3['httpCode'] === 404) { echo json_encode(['error' => 'Kontakt ID ' . $userId . ' NE ISNUJE v Smart Sender']); exit; }
if ($r3['httpCode'] < 200 || $r3['httpCode'] >= 300) {
    echo json_encode(['error' => $step . ' HTTP ' . $r3['httpCode'] . ': ' . $r3['raw']]);
    exit;
}

// KROK 4: VISHAJEMO teg na kontakt
$step = 'KROK 4: Privyazka tegu';
$r4 = ssApi('POST', 'https://api.smartsender.com/v1/contacts/' . urlencode($userId) . '/tags/' . urlencode($tagId), $token);

if ($r4['curlError']) { echo json_encode(['error' => $step . ' cURL: ' . $r4['curlError']]); exit; }

if ($r4['httpCode'] >= 200 && $r4['httpCode'] < 300) {
    echo json_encode(['state' => true, 'tagId' => $tagId, 'userId' => $userId, 'tagName' => $tagName]);
} elseif ($r4['httpCode'] === 404) {
    echo json_encode(['error' => $step . ' Kontakt abo teg ne znajdeno (404). userId=' . $userId . ', tagId=' . $tagId]);
} elseif ($r4['httpCode'] === 422) {
    echo json_encode(['state' => true, 'tagId' => $tagId, 'userId' => $userId, 'tagName' => $tagName, 'note' => 'Teg vzhe buv privyazanij']);
} else {
    $msg = isset($r4['data']['message']) ? $r4['data']['message'] : $r4['raw'];
    echo json_encode(['error' => $step . ' HTTP ' . $r4['httpCode'] . ': ' . $msg]);
}
?>
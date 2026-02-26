<?php
// Smart Sender API Proxy v5
// Kody pomylok:
// E01 - nevalidnij JSON vhid
// E02 - userId porozhnij
// E03 - tagName porozhnij
// E10 - poshuk tegu: zʼyednannya
// E11 - poshuk tegu: HTTP pomylka
// E20 - stvorennya tegu: zʼyednannya
// E21 - stvorennya tegu: HTTP pomylka
// E22 - teg isnuje ale ne znajdeno
// E30 - kontakt: zʼyednannya
// E31 - kontakt ne isnuje v Smart Sender
// E32 - kontakt: HTTP pomylka
// E40 - pryviazka tegu: zʼyednannya
// E41 - kontakt abo teg ne znajdeno (404)
// E42 - pryviazka tegu: HTTP pomylka

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
        'data' => json_decode($res, true)
    ];
    curl_close($ch);
    return $info;
}

function fail($code) {
    echo json_encode(['error' => $code]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) fail('E01');

$userId  = isset($input['userId'])  ? trim($input['userId'])  : '';
$tagName = isset($input['tagName']) ? trim($input['tagName']) : '';

if (empty($userId))  fail('E02');
if (empty($tagName)) fail('E03');

// Poshuk tegu po vsih storinkah
function findTagByName($tagName, $token) {
    $page = 1;
    $maxPages = 10;
    do {
        $r = ssApi('GET', 'https://api.smartsender.com/v1/tags?term=' . urlencode($tagName) . '&page=' . $page . '&limitation=50', $token);
        if ($r['curlError']) return ['error' => 'E10'];
        if ($r['httpCode'] < 200 || $r['httpCode'] >= 300) return ['error' => 'E11'];

        $collection = [];
        if (isset($r['data']['collection'])) $collection = $r['data']['collection'];
        elseif (isset($r['data']['data'])) $collection = $r['data']['data'];
        elseif (is_array($r['data'])) $collection = $r['data'];

        foreach ($collection as $tag) {
            if (isset($tag['name']) && strtolower(trim($tag['name'])) === strtolower(trim($tagName))) {
                return ['id' => $tag['id']];
            }
        }

        $totalPages = isset($r['data']['cursor']['pages']) ? (int)$r['data']['cursor']['pages'] : 1;
        $page++;
    } while ($page <= $totalPages && $page <= $maxPages);

    return ['id' => null];
}

// KROK 1: Shukajemo teg
$found = findTagByName($tagName, $token);
if (isset($found['error'])) fail($found['error']);
$tagId = $found['id'];

// KROK 2: Stvoryujemo teg yakshcho ne znajshly
if (!$tagId) {
    $r2 = ssApi('POST', 'https://api.smartsender.com/v1/tags', $token, [
        'name' => $tagName,
        'color' => 'FF0000'
    ]);

    if ($r2['curlError']) fail('E20');

    if (isset($r2['data']['id'])) {
        $tagId = $r2['data']['id'];
    } elseif ($r2['httpCode'] === 422 || $r2['httpCode'] === 409) {
        usleep(500000);
        $found2 = findTagByName($tagName, $token);
        if (isset($found2['error'])) fail($found2['error']);
        $tagId = $found2['id'];
        if (!$tagId) fail('E22');
    } else {
        fail('E21');
    }
}

// KROK 3: Pereviryajemo kontakt
$r3 = ssApi('GET', 'https://api.smartsender.com/v1/contacts/' . urlencode($userId), $token);

if ($r3['curlError']) fail('E30');
if ($r3['httpCode'] === 404) fail('E31');
if ($r3['httpCode'] < 200 || $r3['httpCode'] >= 300) fail('E32');

// KROK 4: Vishajemo teg
$r4 = ssApi('POST', 'https://api.smartsender.com/v1/contacts/' . urlencode($userId) . '/tags/' . urlencode($tagId), $token);

if ($r4['curlError']) fail('E40');

if ($r4['httpCode'] >= 200 && $r4['httpCode'] < 300) {
    echo json_encode(['state' => true, 'tagId' => $tagId, 'userId' => $userId, 'tagName' => $tagName]);
} elseif ($r4['httpCode'] === 404) {
    fail('E41');
} elseif ($r4['httpCode'] === 422) {
    echo json_encode(['state' => true, 'tagId' => $tagId, 'userId' => $userId, 'tagName' => $tagName, 'note' => 'already_tagged']);
} else {
    fail('E42');
}
?>
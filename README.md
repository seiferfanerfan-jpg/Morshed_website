# morshed_Ai — مرشد

واجهة عربية أولية لمساعد مرشد، مبنية بـReact وTypeScript وVite.

## التشغيل المحلي

```bash
npm install
npm run dev
```

لإنشاء نسخة الإنتاج والتحقق من الأنواع:

```bash
npm run build
```

## حالة المساعد

واجهة المحادثة متصلة بـGemini عبر Cloudflare Pages Function. لا تضع مفاتيح سرية في كود المتصفح أو في ملفات Git.

## فيديو الشعار

تُعرض مقدمة فيديو الشعار من `public/assets/morshed-logo-intro.mp4`، مع تشغيل صامت وزر تخطٍ.

## النشر على Cloudflare Pages

الموقع المنشور: https://morshed-ai-8vu.pages.dev/

أنشئ المشروع كرفع مباشر باستخدام Wrangler. لإعادة النشر بعد تعديل الموقع، اضبط `CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_ACCOUNT_ID` في بيئتك دون حفظهما في Git، ثم شغّل:

```bash
npm run build
npx wrangler pages deploy dist --project-name=morshed-ai --branch=main
```

المشروع الحالي غير مربوط تلقائيًا بمستودع GitHub؛ يلزم تنفيذ أمر الرفع بعد التعديلات. Cloudflare لا يسمح بتحويل مشروع Pages الذي بدأ بالرفع المباشر إلى Git integration لاحقًا؛ إعداد النشر التلقائي يتطلب مشروع Pages جديدًا مربوطًا بـGitHub.

## حالة تكلفة AI

يستخدم المشروع Gemini API من Google. لا يوجد تحويل تلقائي إلى مزوّد أو خطة مدفوعة عند بلوغ حد الاستخدام؛ يُعرض خطأ بدل ذلك.

## ربط Gemini بأمان

يستخدم الخادم Cloudflare Pages Function في `functions/api/chat.js`، وتُرسل الرسائل إلى Gemini من الخادم فقط. لا تضع مفتاح API في ملفات الواجهة أو GitHub.

المفتاح محفوظ في Cloudflare Pages كـ **Secret** باسم `GEMINI_API_KEY`. النموذج المحدد هو `gemini-3.5-flash-lite`، مع حد 512 رمزًا للإجابة وسجل محادثة قصير.

حصة Gemini المجانية وحدودها يحددها حساب Google وقد تختلف عن حصة Cloudflare. راجع التسعير وحدود المشروع في Google AI Studio؛ الكود لا يحوّل إلى مزوّد أو خطة مدفوعة عند تلقي حدّ الاستخدام.

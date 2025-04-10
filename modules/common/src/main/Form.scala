package lila.common

import java.nio.charset.StandardCharsets.UTF_8
import scala.util.Try

import play.api.data.Field
import play.api.data.FormError
import play.api.data.Forms._
import play.api.data.JodaForms._
import play.api.data.Mapping
import play.api.data.format.Formats._
import play.api.data.format.Formatter
import play.api.data.format.JodaFormats
import play.api.data.validation.Constraint
import play.api.data.validation.Constraints

import org.joda.time.DateTime
import org.joda.time.DateTimeZone

import shogi.format.forsyth.Sfen

import lila.common.base.StringUtils

object Form {

  type Options[A] = Iterable[(A, String)]

  type FormLike = {
    def apply(key: String): Field
    def errors: Seq[FormError]
  }

  def options(it: Iterable[Int], pattern: String): Options[Int] =
    it map { d =>
      d -> (pluralize(pattern, d) format d)
    }

  def options(it: Iterable[Int], transformer: Int => Int, pattern: String): Options[Int] =
    it map { d =>
      d -> (pluralize(pattern, transformer(d)) format transformer(d))
    }

  def options(it: Iterable[Int], code: String, pattern: String): Options[String] =
    it map { d =>
      s"$d$code" -> (pluralize(pattern, d) format d)
    }

  def options(it: Iterable[Int], format: Int => String): Options[Int] =
    it map { d =>
      d -> format(d)
    }

  def optionsDouble(it: Iterable[Double], format: Double => String): Options[Double] =
    it map { d =>
      d -> format(d)
    }

  private def mustBeOneOf(choices: Iterable[Any]) = s"Must be one of: ${choices mkString ", "}"

  def numberIn(choices: Options[Int]) =
    number.verifying(mustBeOneOf(choices.map(_._1)), hasKey(choices, _))

  def numberIn(choices: Set[Int]) =
    number.verifying(mustBeOneOf(choices), choices.contains _)

  def numberIn(choices: Seq[Int]) =
    number.verifying(mustBeOneOf(choices), choices.contains _)

  def numberInDouble(choices: Seq[Double]) =
    of[Double].verifying(mustBeOneOf(choices), choices.contains _)

  def numberInDouble(choices: Options[Double]) =
    of[Double].verifying(mustBeOneOf(choices.map(_._1)), hasKey(choices, _))

  def trim(m: Mapping[String]) = m.transform[String](_.trim, identity)

  // trims and removes garbage chars before validation
  val cleanTextFormatter: Formatter[String] = new Formatter[String] {
    def bind(key: String, data: Map[String, String]) =
      data
        .get(key)
        .map(_.trim)
        .map(StringUtils.removeGarbageChars)
        .toRight(Seq(FormError(key, "error.required", Nil)))
    def unbind(key: String, value: String) = Map(key -> StringUtils.removeGarbageChars(value.trim))
  }

  val cleanText: Mapping[String] = of(cleanTextFormatter)
  def cleanText(minLength: Int = 0, maxLength: Int = Int.MaxValue): Mapping[String] =
    (minLength, maxLength) match {
      case (min, Int.MaxValue) => cleanText.verifying(Constraints.minLength(min))
      case (0, max)            => cleanText.verifying(Constraints.maxLength(max))
      case (min, max) => cleanText.verifying(Constraints.minLength(min), Constraints.maxLength(max))
    }

  val cleanNonEmptyText: Mapping[String] = cleanText.verifying(Constraints.nonEmpty)
  def cleanNonEmptyText(minLength: Int = 0, maxLength: Int = Int.MaxValue): Mapping[String] =
    cleanText(minLength, maxLength).verifying(Constraints.nonEmpty)

  def stringIn(choices: Options[String]) =
    cleanText.verifying(hasKey(choices, _))

  def stringIn(choices: Set[String]) =
    cleanText.verifying(mustBeOneOf(choices), choices.contains _)

  def urlText =
    text.verifying { url =>
      url.getBytes(UTF_8).sizeIs < 350 && (url.isEmpty || url.startsWith("https://") || url
        .startsWith(
          "//",
        ))
    }

  def tolerantBoolean = of[Boolean](formatter.tolerantBooleanFormatter)

  def hasKey[A](choices: Options[A], key: A) =
    choices.map(_._1).toList contains key

  def trueish(v: Any) = v == 1 || v == "1" || v == "true" || v == "on" || v == "yes"

  private def pluralize(pattern: String, nb: Int) =
    pattern.replace("{s}", if (nb == 1) "" else "s")

  object formatter {
    def stringFormatter[A](from: A => String, to: String => A): Formatter[A] =
      new Formatter[A] {
        def bind(key: String, data: Map[String, String]) = stringFormat.bind(key, data) map to
        def unbind(key: String, value: A)                = stringFormat.unbind(key, from(value))
      }
    def intFormatter[A](from: A => Int, to: Int => A): Formatter[A] =
      new Formatter[A] {
        def bind(key: String, data: Map[String, String]) = intFormat.bind(key, data) map to
        def unbind(key: String, value: A)                = intFormat.unbind(key, from(value))
      }
    val tolerantBooleanFormatter: Formatter[Boolean] = new Formatter[Boolean] {
      override val format = Some(("format.boolean", Nil))
      def bind(key: String, data: Map[String, String]) =
        Right(data.getOrElse(key, "false")).flatMap { v =>
          Right(trueish(v))
        }
      def unbind(key: String, value: Boolean) = Map(key -> value.toString)
    }
  }

  object constraint {
    import play.api.data.{ validation => V }
    def minLength[A](from: A => String)(length: Int): Constraint[A] =
      Constraint[A]("constraint.minLength", length) { o =>
        if (from(o).sizeIs >= length) V.Valid
        else V.Invalid(V.ValidationError("error.minLength", length))
      }
    def maxLength[A](from: A => String)(length: Int): Constraint[A] =
      Constraint[A]("constraint.maxLength", length) { o =>
        if (from(o).sizeIs <= length) V.Valid
        else V.Invalid(V.ValidationError("error.maxLength", length))
      }
  }

  object sfen {
    implicit private val sfenFormat: Formatter[Sfen] =
      formatter.stringFormatter[Sfen](_.value, Sfen.clean)
    def clean = of[Sfen](sfenFormat)
  }

  def inTheFuture(m: Mapping[DateTime]) =
    m.verifying(
      "The date must be set in the future",
      DateTime.now.isBefore(_),
    )

  object UTCDate {
    val dateTimePattern = "yyyy-MM-dd HH:mm"
    val utcDate         = jodaDate(dateTimePattern, DateTimeZone.UTC)
    implicit val dateTimeFormat: Formatter[DateTime] =
      JodaFormats.jodaDateTimeFormat(dateTimePattern)
  }
  object ISODateTime {
    val dateTimePattern = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
    val formatter       = JodaFormats.jodaDateTimeFormat(dateTimePattern, DateTimeZone.UTC)
    val isoDateTime     = jodaDate(dateTimePattern, DateTimeZone.UTC)
    implicit val dateTimeFormat: Formatter[DateTime] =
      JodaFormats.jodaDateTimeFormat(dateTimePattern)
  }
  object ISODate {
    val datePattern = "yyyy-MM-dd"
    val formatter   = JodaFormats.jodaDateTimeFormat(datePattern, DateTimeZone.UTC)
    val isoDateTime = jodaDate(datePattern, DateTimeZone.UTC)
    implicit val dateFormat: Formatter[DateTime] = JodaFormats.jodaDateTimeFormat(datePattern)
  }
  object Timestamp {
    val formatter = new Formatter[org.joda.time.DateTime] {
      @scala.annotation.nowarn("cat=lint")
      def bind(key: String, data: Map[String, String]) =
        stringFormat
          .bind(key, data)
          .flatMap { str =>
            Try(java.lang.Long.parseLong(str)).toEither.flatMap { long =>
              Try(new DateTime(long)).toEither
            }
          }
          .left
          .map(_ => Seq(FormError(key, "Invalid timestamp", Nil)))
      def unbind(key: String, value: org.joda.time.DateTime) = Map(key -> value.getMillis.toString)
    }
    val timestamp = of[org.joda.time.DateTime](formatter)
  }
  object ISODateOrTimestamp {
    val formatter = new Formatter[org.joda.time.DateTime] {
      def bind(key: String, data: Map[String, String]) =
        ISODate.formatter.bind(key, data) orElse Timestamp.formatter.bind(key, data)
      def unbind(key: String, value: org.joda.time.DateTime) = ISODate.formatter.unbind(key, value)
    }
    val isoDateOrTimestamp = of[org.joda.time.DateTime](formatter)
  }
  object ISODateTimeOrTimestamp {
    val formatter = new Formatter[org.joda.time.DateTime] {
      def bind(key: String, data: Map[String, String]) =
        ISODateTime.formatter.bind(key, data) orElse Timestamp.formatter.bind(key, data)
      def unbind(key: String, value: org.joda.time.DateTime) =
        ISODateTime.formatter.unbind(key, value)
    }
    val isoDateTimeOrTimestamp = of[org.joda.time.DateTime](formatter)
  }
}
